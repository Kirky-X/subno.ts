#!/bin/bash

# SecureNotify 部署脚本
# 自动化部署流程：检查端口、启动服务、运行迁移、启动应用

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
POSTGRES_PORT=5435
REDIS_PORT=6380
APP_PORT=3000

echo "========================================="
echo "SecureNotify 自动部署"
echo "========================================="

# 函数：检查端口是否被占用
check_port() {
    local port=$1
    local service_name=$2

    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}警告: 端口 $port ($service_name) 已被占用${NC}"
        read -p "是否终止占用该端口的进程? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "正在终止占用端口 $port 的进程..."
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 2
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo -e "${RED}错误: 无法释放端口 $port${NC}"
                exit 1
            fi
            echo -e "${GREEN}端口 $port 已释放${NC}"
        else
            echo -e "${RED}部署取消${NC}"
            exit 1
        fi
    fi
}

# 函数：等待服务就绪
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=30
    local attempt=1

    echo "等待 $service_name 就绪..."
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" > /dev/null 2>&1; then
            echo -e "${GREEN}$service_name 已就绪${NC}"
            return 0
        fi
        echo "  尝试 $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}错误: $service_name 未能在预期时间内就绪${NC}"
    exit 1
}

# 步骤1: 检查端口占用
echo ""
echo "【步骤1】检查端口占用..."
check_port $POSTGRES_PORT "PostgreSQL"
check_port $REDIS_PORT "Redis"
check_port $APP_PORT "Next.js应用"
echo -e "${GREEN}端口检查完成${NC}"

# 步骤2: 启动Docker服务
echo ""
echo "【步骤2】启动Docker服务..."
docker-compose up -d
echo -e "${GREEN}Docker服务已启动${NC}"

# 步骤3: 等待数据库就绪
echo ""
echo "【步骤3】等待数据库就绪..."
wait_for_service "PostgreSQL" "docker exec securenotify-postgres pg_isready -U securenotify -p 5432"
wait_for_service "Redis" "docker exec securenotify-redis redis-cli ping"

# 步骤4: 检查环境变量文件
echo ""
echo "【步骤4】检查环境变量..."
if [ ! -f .env.local ]; then
    if [ -f .env ]; then
        cp .env .env.local
        echo "已创建 .env.local"
    else
        echo -e "${RED}错误: 未找到 .env 文件${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}环境变量配置完成${NC}"

# 步骤5: 安装依赖
echo ""
echo "【步骤5】安装依赖..."
if [ ! -d node_modules ]; then
    npm install
    echo -e "${GREEN}依赖安装完成${NC}"
else
    echo "依赖已存在，跳过安装"
fi

# 步骤6: 运行数据库迁移
echo ""
echo "【步骤6】运行数据库迁移..."
npx drizzle-kit generate
echo -e "${GREEN}数据库迁移完成${NC}"

# 步骤7: 清理Next.js锁文件
echo ""
echo "【步骤7】清理Next.js锁文件..."
rm -f .next/dev/lock 2>/dev/null || true
echo "锁文件已清理"

# 步骤8: 启动Next.js应用
echo ""
echo "【步骤8】启动Next.js应用..."
npm run dev &
APP_PID=$!

# 等待应用启动
echo "等待应用启动..."
sleep 10

# 检查应用是否成功启动
if ! kill -0 $APP_PID 2>/dev/null; then
    echo -e "${RED}错误: Next.js应用启动失败${NC}"
    exit 1
fi

# 检查端口是否监听
if ! lsof -Pi :$APP_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}错误: Next.js应用未能监听端口 $APP_PORT${NC}"
    kill $APP_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "========================================="
echo -e "${GREEN}部署成功！${NC}"
echo "========================================="
echo "PostgreSQL: http://localhost:$POSTGRES_PORT"
echo "Redis: http://localhost:$REDIS_PORT"
echo "Next.js应用: http://localhost:$APP_PORT"
echo ""
echo "应用进程ID: $APP_PID"
echo "使用 'kill $APP_PID' 停止应用"
echo "========================================="

# 保存PID到文件
echo $APP_PID > .next/app.pid