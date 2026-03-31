#!/bin/bash

# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

# ============================================================================
# 枚举迁移辅助脚本
# 
# 用途：帮助识别和迁移字符串字面量到枚举类型
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$PROJECT_ROOT/src"
SDK_DIR="$PROJECT_ROOT/sdk/typescript/src"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}枚举迁移辅助工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 函数：搜索频道类型字符串
search_channel_types() {
    echo -e "${YELLOW}📊 搜索频道类型字符串...${NC}"
    echo ""
    
    echo "查找 'public', 'encrypted', 'temporary':"
    grep -rn "'public'\|'encrypted'\|'temporary'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        grep -v "node_modules" | \
        grep -v ".next" | \
        head -30
    
    echo ""
}

# 函数：搜索权限字符串
search_permissions() {
    echo -e "${YELLOW}🔐 搜索权限相关字符串...${NC}"
    echo ""
    
    echo "查找 'read', 'write', 'publish', 'subscribe', 'register', 'revoke', 'admin':"
    grep -rn "'read'\|'write'\|'publish'\|'subscribe'\|'register'\|'revoke'\|'admin'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        grep -v "node_modules" | \
        grep -v ".next" | \
        grep -v "\.d\.ts" | \
        head -50
    
    echo ""
}

# 函数：搜索速率限制端点
search_rate_limit_endpoints() {
    echo -e "${YELLOW}⚡ 搜索速率限制端点...${NC}"
    echo ""
    
    echo "查找速率限制相关的端点判断:"
    grep -rn "includes.*'/publish'\|includes.*'/register'\|includes.*'/subscribe'\|includes.*'/revoke'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        head -20
    
    echo ""
}

# 函数：搜索算法字符串
search_algorithms() {
    echo -e "${YELLOW}🔑 搜索加密算法字符串...${NC}"
    echo ""
    
    echo "查找 'RSA-2048', 'RSA-4096', 'ECDSA', 'Ed25519':"
    grep -rn "'RSA-\|'ECDSA\|'Ed25519'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        head -20
    
    echo ""
}

# 函数：搜索状态字符串
search_status_strings() {
    echo -e "${YELLOW}📈 搜索状态字符串...${NC}"
    echo ""
    
    echo "查找 'active', 'inactive', 'pending', 'confirmed', 'cancelled', 'expired':"
    grep -rn "'active'\|'inactive'\|'pending'\|'confirmed'\|'cancelled'\|'expired'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        grep -v "RevocationStatus" | \
        grep -v "DeliveryStatus" | \
        head -30
    
    echo ""
}

# 函数：统计需要迁移的文件
count_migration_targets() {
    echo -e "${YELLOW}📊 统计需要迁移的目标数量...${NC}"
    echo ""
    
    # 频道类型
    channel_count=$(grep -r "'public'\|'encrypted'\|'temporary'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        wc -l)
    echo "频道类型字符串：$channel_count 处"
    
    # 权限字符串
    perm_count=$(grep -r "'read'\|'write'\|'publish'\|'subscribe'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        grep -v "ApiKeyPermission" | \
        wc -l)
    echo "权限字符串：约 $perm_count 处"
    
    # 速率限制端点
    rate_count=$(grep -r "includes.*'/publish'\|includes.*'/register'" \
        --include="*.ts" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        "$SRC_DIR" 2>/dev/null | \
        wc -l)
    echo "速率限制端点：$rate_count 处"
    
    echo ""
}

# 函数：生成迁移报告
generate_migration_report() {
    echo -e "${YELLOW}📝 生成迁移报告...${NC}"
    echo ""
    
    REPORT_FILE="$PROJECT_ROOT/MIGRATION_ANALYSIS.md"
    
    cat > "$REPORT_FILE" << 'EOF'
# 枚举迁移分析报告

## 生成时间

$(date '+%Y-%m-%d %H:%M:%S')

## 文件清单

### 需要修改的文件

#### 1. 数据库 Schema
- [ ] src/db/schema.ts
  - Channel type 字段
  - API Key permissions 字段
  - Algorithm 字段

#### 2. 服务层
- [ ] src/lib/services/channel.service.ts
- [ ] src/lib/services/api-key.service.ts
- [ ] src/lib/services/message.service.ts

#### 3. 中间件
- [ ] src/lib/middleware/rate-limit.ts
- [ ] src/lib/middleware/auth.ts

#### 4. 配置文件
- [ ] src/lib/config/env.ts

### 已创建的枚举文件

✅ src/lib/enums/channel.enums.ts
✅ src/lib/enums/permission.enums.ts
✅ src/lib/enums/ratelimit.enums.ts
✅ src/lib/enums/config.enums.ts
✅ src/lib/enums/algorithm.enums.ts
✅ src/lib/enums/environment.enums.ts
✅ src/lib/enums/index.ts

## 迁移步骤

### Phase 1: 准备阶段 ✅
- [x] 创建枚举目录
- [x] 定义枚举类型
- [x] 创建工具函数

### Phase 2: 数据库迁移 ⏳
- [ ] 更新 schema.ts
- [ ] 运行类型检查
- [ ] 执行数据库迁移（如需要）

### Phase 3: 服务层迁移 ⏳
- [ ] 更新频道服务
- [ ] 更新 API 密钥服务
- [ ] 更新消息服务

### Phase 4: 中间件迁移 ⏳
- [ ] 更新速率限制中间件
- [ ] 更新认证中间件

### Phase 5: 测试验证 ⏳
- [ ] 运行单元测试
- [ ] 运行集成测试
- [ ] 性能基准测试

## 注意事项

1. 保持向后兼容性
2. 逐步迁移，不要一次性全部替换
3. 每个阶段完成后运行测试
4. 记录遇到的问题和解决方案

EOF

    echo "迁移报告已生成：$REPORT_FILE"
    echo ""
}

# 函数：显示使用示例
show_usage_examples() {
    echo -e "${YELLOW}💡 使用示例:${NC}"
    echo ""
    echo "查看枚举使用示例："
    echo "  code $PROJECT_ROOT/ENUM_USAGE_EXAMPLES.ts"
    echo ""
    echo "查看快速参考："
    echo "  code $PROJECT_ROOT/ENUM_QUICK_REFERENCE.md"
    echo ""
    echo "查看详细迁移计划："
    echo "  code $PROJECT_ROOT/ENUM_MIGRATION_PLAN.md"
    echo ""
}

# 主菜单
show_menu() {
    echo -e "${GREEN}请选择操作:${NC}"
    echo "1. 搜索所有可迁移的字符串"
    echo "2. 仅搜索频道类型"
    echo "3. 仅搜索权限字符串"
    echo "4. 仅搜索速率限制端点"
    echo "5. 仅搜索算法字符串"
    echo "6. 仅搜索状态字符串"
    echo "7. 统计迁移目标数量"
    echo "8. 生成迁移报告"
    echo "9. 显示使用示例"
    echo "10. 退出"
    echo ""
}

# 主循环
while true; do
    show_menu
    read -p "请输入选项 (1-10): " choice
    
    case $choice in
        1)
            search_channel_types
            search_permissions
            search_rate_limit_endpoints
            search_algorithms
            search_status_strings
            ;;
        2)
            search_channel_types
            ;;
        3)
            search_permissions
            ;;
        4)
            search_rate_limit_endpoints
            ;;
        5)
            search_algorithms
            ;;
        6)
            search_status_strings
            ;;
        7)
            count_migration_targets
            ;;
        8)
            generate_migration_report
            ;;
        9)
            show_usage_examples
            ;;
        10)
            echo -e "${GREEN}再见！${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}无效的选项，请重新输入${NC}"
            ;;
    esac
done
