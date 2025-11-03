# =============================================================
# Go 多架构编译 (只编译 Go，不涉及 Node/Python)
# =============================================================
FROM --platform=$BUILDPLATFORM golang:1.23.10-bookworm AS go-server-builder
WORKDIR /app
COPY backend/go-service/ ./
RUN go mod tidy
ENV GIN_MODE=release
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$(echo $TARGETPLATFORM | cut -d'/' -f2) \
    go build -o go-service main.go

# =============================================================
# Node 前端 (只在 amd64 编译一次)
# =============================================================
FROM --platform=linux/amd64 node:22-bookworm-slim AS builder
WORKDIR /web
COPY package.json ./
RUN npm install
COPY . .
ENV NEXT_PUBLIC_BASE_PATH=/apps/ai-agent
ENV NEXT_PUBLIC_API_URL=/apps/ai-agent/api
ENV NEXT_PUBLIC_API_BASE_URL=/apps/ai-agent/api
ENV NEXT_OUTPUT_MODE=standalone
RUN npm run build

# =============================================================
# Python AI (只在 amd64 构建一次)
# =============================================================
FROM --platform=linux/amd64 astral/uv:python3.12-bookworm-slim AS python-builder
WORKDIR /web/python-ai
COPY backend/python-ai/pyproject.toml .
COPY backend/python-ai/uv.lock .
RUN uv sync --frozen --no-install-project --no-dev --no-cache
COPY backend/python-ai/src/ ./

# =============================================================
# 生产镜像 (multi-arch，但 Node/Python 用 amd64 的结果)
# =============================================================
FROM astral/uv:python3.12-bookworm-slim AS production
WORKDIR /web

# 拷贝 Python 产物 (amd64 构建)
COPY --from=python-builder /web/python-ai /web/python-ai

# 拷贝 Go 产物 (multi-arch)
COPY --from=go-server-builder /app/go-service /web/go-service

RUN apt-get update && apt-get install -y curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*
# 拷贝前端产物 (amd64 构建)
COPY --from=builder /web/.next/standalone/ /web/
COPY --from=builder /web/.next/static/ /web/.next/static/
COPY --from=builder /web/public/ /web/public/

# 创建启动脚本
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
uvicorn main:app --host 0.0.0.0 --port 8001 --workers $WORKERS --env-file /web/.env --log-config uvicorn_config.json &

# 启动Go后端服务
cd /web
# ./go-service &

# 启动前端
node /web/server.js &
exec ./go-service
EOF
RUN chmod +x /web/start.sh

ENV SYSTEM_MODE=integrated

CMD ["/web/start.sh"]
