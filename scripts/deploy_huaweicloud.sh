#!/bin/bash
set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SecureNotify 华为云部署助手 ===${NC}"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}错误: Docker 未运行或未安装。请先启动 Docker。${NC}"
  exit 1
fi

# 获取配置信息
read -p "请输入华为云区域 (例如 cn-north-4): " REGION
read -p "请输入 SWR 组织名称: " ORG
read -p "请输入版本号 (例如 v1.0.0): " VERSION

if [ -z "$REGION" ] || [ -z "$ORG" ] || [ -z "$VERSION" ]; then
  echo -e "${RED}错误: 所有字段都必须填写。${NC}"
  exit 1
fi

IMAGE_TAG="swr.${REGION}.myhuaweicloud.com/${ORG}/securenotify:${VERSION}"

echo -e "\n${YELLOW}即将构建镜像: ${IMAGE_TAG}${NC}"
read -p "确认继续? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 构建镜像
echo -e "\n${GREEN}>>> 开始构建镜像...${NC}"
docker build -t "$IMAGE_TAG" .

# 推送提示
echo -e "\n${GREEN}>>> 构建成功!${NC}"
echo -e "${YELLOW}在推送之前，请确保你已经登录了华为云 SWR:${NC}"
echo "docker login -u [username] -p [password] swr.${REGION}.myhuaweicloud.com"
echo
read -p "是否立即推送镜像? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${GREEN}>>> 开始推送镜像...${NC}"
    docker push "$IMAGE_TAG"
    
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}>>> 推送成功!${NC}"
        echo -e "下一步：请前往华为云 FunctionGraph 控制台，创建或更新函数，使用镜像：${IMAGE_TAG}"
    else
        echo -e "\n${RED}>>> 推送失败。请检查网络或登录状态。${NC}"
    fi
else
    echo -e "\n${YELLOW}已跳过推送。你可以稍后手动运行:${NC}"
    echo "docker push ${IMAGE_TAG}"
fi
