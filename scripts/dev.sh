#!/bin/bash

source $(dirname $0)/utils.sh

echo "🚀 DooTask AI 完整开发环境启动"
echo "==============================="
echo "启动：前端 + Go后端 + Python AI服务"
echo ""

# 检查依赖
echo "🔍 检查环境依赖..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装! 请安装Node.js 22+: https://nodejs.org/"
    exit 1
fi

if ! command -v go &> /dev/null; then
    echo "❌ Go 未安装! 请安装Go 1.22+: https://golang.org/dl/"
    exit 1
fi

if ! command -v air &> /dev/null; then
    [ -z "$GOPATH" ] && export PATH=$PATH:$(go env GOPATH)/bin
    command -v air &> /dev/null || { echo "❌ air 未安装! 请安装air: https://github.com/air-verse/air"; exit 1; }
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装! 请安装Python 3.8+: https://www.python.org/"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装! 请安装Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装! 请安装Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

if ! command -v uv &> /dev/null; then
    echo "❌ uv 未安装! 请安装uv: curl -LsSf https://astral.sh/uv/0.7.19/install.sh | sh"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ Go: $(go version | cut -d' ' -f3)"
echo "✅ Python: $(python3 --version)"
echo "✅ Docker: $(docker --version)"
echo "✅ Docker Compose: $(docker-compose --version)"
echo "✅ uv: $(uv --version)"
echo ""

# 准备Go后端
echo "🎯 准备Go后端..."
pushd backend/go-service > /dev/null
go mod tidy > /dev/null 2>&1
popd > /dev/null

# 准备Python AI服务
echo "🤖 准备Python AI服务..."
pushd backend/python-ai > /dev/null
if [ ! -d ".venv" ]; then
    echo "📦 创建Python虚拟环境..."
    uv sync
fi
popd > /dev/null

echo ""
echo "🚀 启动所有服务..."
echo ""

# 启动数据库服务
echo "🎯 启动数据库服务..."
docker-compose -f ${CURRENT_DIR}/docker/docker-compose.dev.yml --env-file ${CURRENT_DIR}/.env up -d

# 启动Go后端（后台）
echo "🎯 启动Go后端 (端口$(getEnv GO_SERVICE_PORT))..."
pushd backend/go-service > /dev/null
air --build.cmd "go build -o tmp/server main.go" --build.exclude_dir "uploads,tmp" --build.full_bin "./tmp/server --env-file ${CURRENT_DIR}/.env" &
BACKEND_PID=$!
popd > /dev/null

# 启动AI服务（后台）
echo "🤖 启动AI服务 (端口$(getEnv PYTHON_AI_SERVICE_PORT))..."
pushd backend/python-ai/src > /dev/null
../.venv/bin/uvicorn main:app --host 0.0.0.0 --port $(getEnv PYTHON_AI_SERVICE_PORT) --env-file ${CURRENT_DIR}/.env --reload &
AI_PID=$!
popd > /dev/null

# 检查服务状态
echo "🔍 检查服务状态..."

go_backend_status=false
ai_service_status=false
for i in {1..30}; do
    sleep 1
    if [ $go_backend_status = false ]; then
        if curl -s http://localhost:$(getEnv GO_SERVICE_PORT)/health > /dev/null; then
            go_backend_status=true
        fi
    fi
    if [ $ai_service_status = false ]; then
        if curl -s http://localhost:$(getEnv PYTHON_AI_SERVICE_PORT)/health > /dev/null; then
            ai_service_status=true
        fi
    fi
    if [ $go_backend_status = true ] && [ $ai_service_status = true ]; then
        echo ""
        echo "✅ Go后端启动成功 (PID: $BACKEND_PID)"
        echo "✅ AI服务启动成功 (PID: $AI_PID)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 服务启动失败"
        kill $BACKEND_PID $AI_PID 2>/dev/null
        exit 1
    else
        echo "🔍 服务启动中... ($i/30)"
    fi
done

# 创建停止脚本
cat > scripts/stop.sh << EOF
#!/bin/bash
echo "🛑 停止所有开发服务..."
docker-compose -f ${CURRENT_DIR}/docker/docker-compose.dev.yml --env-file ${CURRENT_DIR}/.env down
pkill -f "air --build.cmd"
pkill -f "uvicorn main:app"
pkill -f "next dev"
echo "✅ 所有服务已停止"
EOF
chmod +x scripts/stop.sh

echo ""
echo "🎉 所有服务启动成功！"
echo "================================="
echo "📱 前端:     http://localhost:$(getEnv APP_PORT)"
echo "⚡ Go后端:   http://localhost:$(getEnv GO_SERVICE_PORT)"
echo "🤖 AI服务:   http://localhost:$(getEnv PYTHON_AI_SERVICE_PORT)"
echo ""
echo "💡 使用 'npm run stop:all' 或 Ctrl+C 停止所有服务"
echo ""

# 启动前端（阻塞进程）
echo "🎯 启动前端开发服务器..."
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "📦 安装/更新依赖..."
    npm install > /dev/null 2>&1
fi
npm run dev

# 前端停止后，清理所有进程
echo ""
echo "🛑 清理所有后台进程..."
kill $BACKEND_PID $AI_PID 2>/dev/null
sleep 0.5
echo "✅ 开发环境已完全停止" 
