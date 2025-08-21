# 后端构建阶段
FROM golang:1.23.10-bookworm AS go-server-builder

# 设置工作目录
WORKDIR /app

# 复制后端相关文件和目录
COPY backend/go-service/ ./

# 安装依赖
RUN go mod tidy

# 设置环境变量
ENV GIN_MODE=release

# 构建后端
RUN CGO_ENABLED=1 go build -o go-service main.go

# =============================================================
# 前端构建阶段
# =============================================================

FROM node:22-bookworm-slim AS builder

# 设置工作目录
WORKDIR /web

# 复制前端相关文件和目录
COPY package.json ./

# 安装依赖
RUN npm install
COPY . .
# 设置环境变量
ENV NEXT_PUBLIC_BASE_PATH=/apps/ai-agent
ENV NEXT_PUBLIC_API_URL=/apps/ai-agent/api
ENV NEXT_PUBLIC_API_BASE_URL=/apps/ai-agent/api
ENV NEXT_OUTPUT_MODE=standalone

# 构建项目
RUN npm run build

# =============================================================
# 生产阶段
# =============================================================

FROM astral/uv:python3.12-bookworm-slim AS production

# 安装系统依赖和Node.js
# RUN apt-get update && apt-get install -y \
#     curl \
#     gnupg \
#     && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
#     && apt-get install -y \
#     nodejs \
#     && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /web/python-ai

ENV UV_COMPILE_BYTECODE=1

COPY backend/python-ai/pyproject.toml .
COPY backend/python-ai/uv.lock .
# RUN pip install --no-cache-dir uv
RUN uv sync --frozen --no-install-project --no-dev --no-cache

COPY backend/python-ai/src/agents/ ./agents/
COPY backend/python-ai/src/api/ ./api/
COPY backend/python-ai/src/core/ ./core/
COPY backend/python-ai/src/memory/ ./memory/
COPY backend/python-ai/src/schema/ ./schema/
COPY backend/python-ai/src/service/ ./service/
COPY backend/python-ai/src/main.py ./main.py

WORKDIR /web

# 复制后端构建产物
COPY --from=go-server-builder /app/go-service /web/go-service

# 复制前端构建产物
COPY --from=builder /usr/local/bin/node /usr/local/bin/
COPY --from=builder /usr/local/bin/npm /usr/local/bin/
COPY --from=builder /web/.next/standalone/ /web/
COPY --from=builder /web/.next/static/ /web/.next/static/
COPY --from=builder /web/public/ /web/public/

# 创建启动脚本
RUN cat <<'EOF' > /web/start.sh
#!/bin/bash

# 激活虚拟环境
source /web/python-ai/.venv/bin/activate

# 设置Python路径
# export PATH="/web/python-ai/.venv/bin:$PATH"
if [ -f "/web/.env" ]; then
    WORKERS=$(cat /web/.env | grep UVICORN_WORKERS | awk -F'=' '{print $2}' | sed 's/\r$//g')
fi
[ -z "$WORKERS" ] && WORKERS=4
# 启动Python AI服务
cd /web/python-ai
uvicorn main:app --host 0.0.0.0 --port 8001 --workers $WORKERS --env-file /web/.env &

# 启动Go后端服务
cd /web
# ./go-service &

# 启动前端
node /web/server.js &
exec ./go-service
EOF

# 设置权限
RUN chmod +x /web/start.sh

# 设置环境变量
ENV SYSTEM_MODE=integrated

# 启动项目
CMD ["/web/start.sh"]