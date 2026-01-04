#!/bin/bash

# Subno.ts Docker 完整部署脚本
# 包括: PostgreSQL, Redis, 应用部署, 全接口测试

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目路径
PROJECT_DIR="/home/project/subno.ts"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Subno.ts Docker 完整部署与测试${NC}"
echo -e "${BLUE}=========================================${NC}"

# 检查Docker
echo -e "\n${YELLOW}[1/6] 检查Docker环境...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 环境检查通过${NC}"

# 停止现有容器
stop_containers() {
    echo -e "\n${YELLOW}[2/6] 停止现有容器...${NC}"
    cd "$PROJECT_DIR"

    # 停止docker-compose管理的容器
    docker-compose down 2>/dev/null || true

    # 停止特定容器
    docker stop subno-postgres 2>/dev/null || true
    docker stop subno-redis 2>/dev/null || true
    docker stop subno-app 2>/dev/null || true

    # 清理网络
    docker network rm subno_network 2>/dev/null || true

    echo -e "${GREEN}✅ 现有容器已停止${NC}"
}

# 启动数据库服务
start_databases() {
    echo -e "\n${YELLOW}[3/6] 启动数据库服务 (PostgreSQL + Redis)...${NC}"

    cd "$PROJECT_DIR"

    # 创建Docker网络
    docker network create subno_network 2>/dev/null || true

    # 启动 PostgreSQL
    echo -e "${BLUE}  启动 PostgreSQL...${NC}"
    docker run -d \
        --name subno-postgres \
        --network subno_network \
        -e POSTGRES_USER=subno \
        -e POSTGRES_PASSWORD=subno123 \
        -e POSTGRES_DB=subno \
        -p 5432:5432 \
        -v subno_postgres_data:/var/lib/postgresql/data \
        postgres:15-alpine

    # 等待PostgreSQL启动
    echo -e "${BLUE}  等待 PostgreSQL 启动...${NC}"
    sleep 3
    until docker exec subno-postgres pg_isready -U subno -q 2>/dev/null; do
        echo -e "${YELLOW}    等待 PostgreSQL...${NC}"
        sleep 1
    done
    echo -e "${GREEN}  ✅ PostgreSQL 已启动${NC}"

    # 启动 Redis
    echo -e "${BLUE}  启动 Redis...${NC}"
    docker run -d \
        --name subno-redis \
        --network subno_network \
        -p 6379:6379 \
        -v subno_redis_data:/data \
        redis:7-alpine \
        redis-server --appendonly yes

    # 等待Redis启动
    echo -e "${BLUE}  等待 Redis 启动...${NC}"
    sleep 2
    until docker exec subno-redis redis-cli ping 2>/dev/null | grep -q PONG; do
        echo -e "${YELLOW}    等待 Redis...${NC}"
        sleep 1
    done
    echo -e "${GREEN}  ✅ Redis 已启动${NC}"

    echo -e "${GREEN}✅ 数据库服务启动完成${NC}"
}

# 配置环境变量
configure_env() {
    echo -e "\n${YELLOW}[4/6] 配置环境变量...${NC}"

    cd "$PROJECT_DIR"

    # 创建或更新 .env 文件
    cat > .env << EOF
# 数据库配置
DATABASE_URL=postgresql://subno:subno123@localhost:5432/subno
REDIS_URL=redis://localhost:6379

# 应用配置
NODE_ENV=development
PORT=3000

# 安全配置
ADMIN_MASTER_KEY=subno-admin-master-key-2024
CRON_SECRET=securenotify-cron-secret-key

# CORS配置
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# 消息配置
PUBLIC_MESSAGE_TTL=43200
PRIVATE_MESSAGE_TTL=86400
PUBLIC_MESSAGE_MAX_COUNT=1000
PRIVATE_MESSAGE_MAX_COUNT=5000

# 频道配置
PERSISTENT_CHANNEL_MAX_TTL=2592000
PERSISTENT_CHANNEL_DEFAULT_TTL=43200
TEMPORARY_CHANNEL_TTL=1800
MAX_CHANNEL_METADATA_SIZE=4096

# 消息大小
MAX_MESSAGE_SIZE=4718592

# 自动创建
AUTO_CREATE_CHANNELS_ENABLED=true

# 加密配置
AES_KEY_LENGTH=32
AES_IV_LENGTH=16
AES_AUTH_TAG_LENGTH=16
RSA_DEFAULT_KEY_SIZE=2048
RSA_HASH_ALGORITHM=sha256
PUBLIC_KEY_CACHE_TTL=604800

# Rate Limiting
RATE_LIMIT_PUBLISH=100
RATE_LIMIT_SUBSCRIBE=5
RATE_LIMIT_REGISTER=10

# 密钥配置
API_KEY_EXPIRY_DAYS=90
API_KEY_PREFIX_LENGTH=8
EOF

    echo -e "${GREEN}✅ 环境变量配置完成${NC}"
}

# 构建并启动应用
start_app() {
    echo -e "\n${YELLOW}[5/6] 构建并启动应用...${NC}"

    cd "$PROJECT_DIR"

    # 安装依赖
    echo -e "${BLUE}  安装 npm 依赖...${NC}"
    npm install

    # 生成Prisma客户端
    echo -e "${BLUE}  生成数据库迁移...${NC}"
    npm run db:generate

    # 推送schema到数据库
    echo -e "${BLUE}  同步数据库Schema...${NC}"
    npm run db:push

    # 构建应用
    echo -e "${BLUE}  构建应用...${NC}"
    npm run build

    # 启动应用
    echo -e "${BLUE}  启动应用服务...${NC}"

    npm run dev > app.log 2>&1 &
    APP_PID=$!

    echo -e "${BLUE}  等待应用启动...${NC}"
    sleep 5

    # 检查应用是否启动
    local attempts=0
    until curl -s http://localhost:3000/api/health > /dev/null 2>&1 || [ $attempts -gt 30 ]; do
        echo -e "${YELLOW}    等待应用启动... ($attempts/30)${NC}"
        sleep 2
        attempts=$((attempts + 1))
    done

    if [ $attempts -gt 30 ]; then
        echo -e "${RED}❌ 应用启动失败，查看日志：tail -50 app.log${NC}"
        tail -50 app.log
        exit 1
    fi

    echo -e "${GREEN}✅ 应用已启动 (PID: $APP_PID)${NC}"
}

# 运行测试
run_tests() {
    echo -e "\n${YELLOW}[6/6] 运行全接口测试...${NC}"

    cd "$PROJECT_DIR"

    # 确保测试脚本可执行
    chmod +x test_api.sh

    # 检查jq是否安装
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq 未安装，安装中...${NC}"
        apt-get update && apt-get install -y jq 2>/dev/null || \
        yum install -y jq 2>/dev/null || \
        apk add jq 2>/dev/null || true
    fi

    # 检查openssl
    if ! command -v openssl &> /dev/null; then
        echo -e "${YELLOW}⚠️  openssl 未安装，尝试安装...${NC}"
        apt-get update && apt-get install -y openssl 2>/dev/null || true
    fi

    echo -e "${BLUE}开始执行测试脚本...${NC}"
    echo ""

    # 运行测试
    bash test_api.sh

    local exit_code=$?

    echo ""
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}=========================================${NC}"
        echo -e "${GREEN}  🎉 所有测试通过！${NC}"
        echo -e "${GREEN}=========================================${NC}"
    else
        echo -e "${RED}=========================================${NC}"
        echo -e "${RED}  ❌ 测试失败，退出码: $exit_code${NC}"
        echo -e "${RED}=========================================${NC}"
    fi

    return $exit_code
}

# 主流程
main() {
    stop_containers
    start_databases
    configure_env
    start_app

    if run_tests; then
        echo -e "\n${GREEN}🎉 部署和测试完成！${NC}"
        echo -e "${GREEN}应用运行在: http://localhost:3000${NC}"
        echo -e "${GREEN}测试页面: http://localhost:3000/SSE_TEST.html${NC}"
    else
        echo -e "\n${RED}❌ 测试失败，请检查日志${NC}"
        exit 1
    fi
}

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}正在清理...${NC}"
    cd "$PROJECT_DIR"
    docker-compose down 2>/dev/null || true
    docker stop subno-postgres subno-redis subno-app 2>/dev/null || true
    docker rm subno-postgres subno-redis subno-app 2>/dev/null || true
    docker network rm subno_network 2>/dev/null || true
    echo -e "${GREEN}清理完成${NC}"
}

# 命令行参数处理
case "${1:-deploy}" in
    deploy)
        main
        ;;
    start)
        start_databases
        configure_env
        start_app
        ;;
    stop)
        stop_containers
        ;;
    test)
        run_tests
        ;;
    restart)
        stop_containers
        main
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        echo "用法: $0 [命令]"
        echo ""
        echo "命令:"
        echo "  deploy   - 完整部署和测试（默认）"
        echo "  start    - 仅启动服务"
        echo "  stop     - 停止所有服务"
        echo "  test     - 运行测试"
        echo "  restart  - 重启所有服务"
        echo "  cleanup  - 清理所有容器和网络"
        echo "  help     - 显示此帮助信息"
        ;;
    *)
        echo "未知命令: $1"
        echo "使用 '$0 help' 查看帮助"
        exit 1
        ;;
esac
