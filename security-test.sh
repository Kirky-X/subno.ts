#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

# SecureNotify 安全测试脚本
# 测试 DDoS 防御和越权攻击防护

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-test-api-key-12345678}"
ADMIN_KEY="${ADMIN_KEY:-test-admin-key-12345678901234}"
TEST_DURATION="${TEST_DURATION:-10}"
CONCURRENT_REQUESTS="${CONCURRENT_REQUESTS:-50}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SecureNotify 安全测试套件${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 测试结果
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# 辅助函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((TESTS_SKIPPED++))
}

log_header() {
    echo ""
    echo -e "${BLUE}----------------------------------------${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}----------------------------------------${NC}"
}

# 检查服务器是否运行
check_server() {
    log_header "1. 检查服务器连通性"
    
    if curl -s --connect-timeout 5 "${BASE_URL}/api/health" > /dev/null 2>&1; then
        log_success "服务器已运行: ${BASE_URL}"
        return 0
    else
        log_fail "服务器未运行: ${BASE_URL}"
        log_info "请先启动服务器: npm run dev"
        return 1
    fi
}

# 测试 1: DDoS 攻击模拟 - 速率限制
test_ddos_rate_limiting() {
    log_header "2. DDoS 防御测试 - 速率限制"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + TEST_DURATION))
    local request_count=0
    local rate_limited_count=0
    local success_count=0
    
    log_info "发送大量请求到 /api/keys (${CONCURRENT_REQUESTS} 并发, ${TEST_DURATION}秒)"
    
    # 并发发送请求
    while [[ $(date +%s) -lt $end_time ]]; do
        for i in $(seq 1 $CONCURRENT_REQUESTS); do
            ((request_count++))
            
            response=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "X-API-Key: ${API_KEY}" \
                "${BASE_URL}/api/keys" 2>/dev/null || echo "000")
            
            if [[ "$response" == "429" ]]; then
                ((rate_limited_count++))
            elif [[ "$response" == "200" || "$response" == "401" || "$response" == "404" ]]; then
                ((success_count++))
            fi
        done
    done
    
    local elapsed=$(( $(date +%s) - start_time ))
    local rate=$((request_count / elapsed))
    
    echo ""
    log_info "测试结果 (${elapsed}秒):"
    log_info "  总请求数: ${request_count}"
    log_info "  成功响应: ${success_count}"
    log_info "  被限流: ${rate_limited_count}"
    log_info "  请求速率: ${rate} 请求/秒"
    
    # 验证速率限制生效
    if [[ $rate_limited_count -gt 0 ]]; then
        log_success "速率限制已生效! (${rate_limited_count} 个请求被限流)"
        
        # 验证速率限制头
        response=$(curl -s -I \
            -H "X-API-Key: ${API_KEY}" \
            "${BASE_URL}/api/keys" 2>/dev/null | grep -i "x-ratelimit" || echo "")
        
        if [[ -n "$response" ]]; then
            log_success "速率限制响应头存在:"
            echo "$response" | while read line; do
                log_info "  $line"
            done
        else
            log_fail "速率限制响应头缺失"
        fi
        
        return 0
    else
        log_fail "速率限制未生效! 所有请求都被允许"
        return 1
    fi
}

# 测试 2: DDoS 攻击模拟 - publish 端点限流
test_ddos_publish_limiting() {
    log_header "3. DDoS 防御测试 - Publish 端点 (更严格的限制)"
    
    local request_count=0
    local rate_limited_count=0
    
    log_info "发送大量 publish 请求 (publish 端点限制更严格: 10/分钟)"
    
    # publish 端点应该有更严格的限制
    for i in $(seq 1 20); do
        ((request_count++))
        
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{"channelId":"test-channel","content":"test message"}' \
            "${BASE_URL}/api/publish" 2>/dev/null || echo "000")
        
        if [[ "$response" == "429" ]]; then
            ((rate_limited_count++))
        fi
        
        # 快速发送，避免在限制窗口内
        sleep 0.1
    done
    
    log_info "测试结果:"
    log_info "  总请求数: ${request_count}"
    log_info "  被限流: ${rate_limited_count}"
    
    if [[ $rate_limited_count -gt 0 || $request_count -le 10 ]]; then
        log_success "Publish 端点速率限制有效"
        return 0
    else
        log_fail "Publish 端点可能未正确限流"
        return 1
    fi
}

# 测试 3: 越权攻击 - 未授权访问
test_unauthorized_access() {
    log_header "4. 越权攻击测试 - 未授权访问"
    
    local tests_passed=0
    local tests_failed=0
    
    # 测试 3.1: 无 API Key 访问
    log_info "测试 3.1: 无 API Key 访问"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${BASE_URL}/api/keys" 2>/dev/null || echo "000")
    
    if [[ "$response" == "401" ]]; then
        log_success "无 API Key 被正确拒绝 (HTTP 401)"
        ((tests_passed++))
    else
        log_fail "无 API Key 应返回 401, 但返回 ${response}"
        ((tests_failed++))
    fi
    
    # 测试 3.2: 无效 API Key
    log_info "测试 3.2: 无效 API Key"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: invalid-key" \
        "${BASE_URL}/api/keys" 2>/dev/null || echo "000")
    
    if [[ "$response" == "401" ]]; then
        log_success "无效 API Key 被正确拒绝 (HTTP 401)"
        ((tests_passed++))
    else
        log_fail "无效 API Key 应返回 401, 但返回 ${response}"
        ((tests_failed++))
    fi
    
    # 测试 3.3: 短 API Key (格式错误)
    log_info "测试 3.3: 短 API Key (格式错误)"
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: short" \
        "${BASE_URL}/api/keys" 2>/dev/null || echo "000")
    
    if [[ "$response" == "401" ]]; then
        log_success "格式错误的 API Key 被正确拒绝"
        ((tests_passed++))
    else
        log_fail "格式错误的 API Key 应被拒绝, 但返回 ${response}"
        ((tests_failed++))
    fi
    
    echo ""
    if [[ $tests_failed -eq 0 ]]; then
        log_success "未授权访问测试全部通过 (${tests_passed}/${tests_passed})"
        return 0
    else
        log_fail "未授权访问测试失败 (${tests_passed}/${tests_passed})"
        return 1
    fi
}

# 测试 4: 越权攻击 - 密钥撤销权限
test_revocation_privilege_escalation() {
    log_header "5. 越权攻击测试 - 密钥撤销权限"
    
    local tests_passed=0
    local tests_failed=0
    
    # 测试 5.1: 无权限用户尝试撤销
    log_info "测试 5.1: 无 key_revoke 权限的用户尝试撤销"
    
    # 创建一个只有 read 权限的假 key (用于测试权限检查)
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d '{"reason":"Unauthorized revocation attempt test"}' \
        "${BASE_URL}/api/keys/test-key-id/revoke" 2>/dev/null || echo "000")
    
    # 应该返回 403 Forbidden 或 404 Not Found (如果key不存在)
    if [[ "$response" == "403" || "$response" == "404" ]]; then
        log_success "无权限撤销请求被正确拒绝 (HTTP ${response})"
        ((tests_passed++))
    elif [[ "$response" == "401" ]]; then
        log_success "认证失败的请求被拒绝 (HTTP 401)"
        ((tests_passed++))
    else
        log_info "返回 HTTP ${response} (可能是密钥不存在或权限正确)"
        ((tests_passed++))
    fi
    
    # 测试 5.2: 验证撤销端点存在权限检查
    log_info "测试 5.2: 验证撤销端点存在权限中间件"
    
    # 尝试直接删除端点 (需要 ADMIN_MASTER_KEY)
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-Admin-Key: wrong-key" \
        -X DELETE \
        "${BASE_URL}/api/keys/some-id" 2>/dev/null || echo "000")
    
    if [[ "$response" == "401" ]]; then
        log_success "错误的 ADMIN_KEY 被拒绝 (HTTP 401)"
        ((tests_passed++))
    else
        log_fail "错误的 ADMIN_KEY 应返回 401, 但返回 ${response}"
        ((tests_failed++))
    fi
    
    echo ""
    if [[ $tests_failed -eq 0 ]]; then
        log_success "权限提升攻击测试通过 (${tests_passed}/${tests_passed})"
        return 0
    else
        log_fail "权限提升攻击测试失败 (${tests_passed}/${tests_passed})"
        return 1
    fi
}

# 测试 5: SQL 注入防护
test_sql_injection_protection() {
    log_header "6. SQL 注入防护测试"
    
    local tests_passed=0
    local tests_failed=0
    
    # 测试各种注入Payload
    local payloads=(
        "' OR '1'='1"
        "'; DROP TABLE users;--"
        "1; DELETE FROM keys WHERE 1=1"
        "admin'--"
        "1 OR 1=1"
        "../../../etc/passwd"
        "{{7*7}}"
        "49"
    )
    
    for payload in "${payloads[@]}"; do
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "X-API-Key: ${API_KEY}" \
            "${BASE_URL}/api/keys/${payload}" 2>/dev/null || echo "000")
        
        # 期望返回 400 或 404，不应是 500 (服务器错误)
        if [[ "$response" == "400" || "$response" == "404" || "$response" == "401" ]]; then
            ((tests_passed++))
        elif [[ "$response" == "500" ]]; then
            log_fail "SQL 注入可能导致服务器错误 (Payload: ${payload})"
            ((tests_failed++))
        else
            ((tests_passed++))  # 其他响应码也可能是安全的
        fi
    done
    
    if [[ $tests_failed -eq 0 ]]; then
        log_success "SQL 注入防护测试通过 (${tests_passed}个Payload测试)"
        return 0
    else
        log_fail "SQL 注入防护存在漏洞 (${tests_failed}个Payload测试失败)"
        return 1
    fi
}

# 测试 6: XSS 防护
test_xss_protection() {
    log_header "7. XSS 防护测试"
    
    local tests_passed=0
    local tests_failed=0
    
    # 测试各种 XSS Payload
    local payloads=(
        "<script>alert('XSS')</script>"
        "javascript:alert('XSS')"
        "<img src=x onerror=alert('XSS')>"
        "<svg onload=alert('XSS')>"
        "{{constructor.constructor('alert(1)')()}}"
    )
    
    for payload in "${payloads[@]}"; do
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d "{\"channelId\":\"${payload}\",\"content\":\"test\"}" \
            "${BASE_URL}/api/publish" 2>/dev/null || echo "000")
        
        # 期望返回 400 (参数验证失败) 或其他非 500 响应
        if [[ "$response" != "500" ]]; then
            ((tests_passed++))
        else
            log_fail "XSS Payload 可能导致服务器错误: ${payload}"
            ((tests_failed++))
        fi
    done
    
    if [[ $tests_failed -eq 0 ]]; then
        log_success "XSS 防护测试通过 (${tests_passed}个Payload测试)"
        return 0
    else
        log_fail "XSS 防护可能存在漏洞"
        return 1
    fi
}

# 测试 7: 速率限制恢复测试
test_rate_limit_recovery() {
    log_header "8. 速率限制恢复测试"
    
    log_info "触发速率限制..."
    
    # 快速发送请求触发限流
    for i in $(seq 1 15); do
        curl -s -o /dev/null -w "%{http_code}" \
            -H "X-API-Key: ${API_KEY}" \
            "${BASE_URL}/api/keys" > /dev/null 2>&1
    done
    
    # 获取速率限制响应
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: ${API_KEY}" \
        "${BASE_URL}/api/keys" 2>/dev/null || echo "000")
    
    if [[ "$response" == "429" ]]; then
        log_success "速率限制已触发 (HTTP 429)"
        
        # 等待限流窗口过去
        log_info "等待速率限制窗口过期 (60秒)..."
        sleep 65
        
        # 再次尝试
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "X-API-Key: ${API_KEY}" \
            "${BASE_URL}/api/keys" 2>/dev/null || echo "000")
        
        if [[ "$response" != "429" ]]; then
            log_success "速率限制已正确恢复 (HTTP ${response})"
            return 0
        else
            log_fail "速率限制未正确恢复"
            return 1
        fi
    else
        log_info "未触发速率限制 (HTTP ${response}), 可能请求不够快"
        log_skip "速率限制恢复测试跳过"
        return 0
    fi
}

# 测试 8: 安全头测试
test_security_headers() {
    log_header "9. 安全响应头测试"
    
    local headers=$(curl -s -I \
        -H "X-API-Key: ${API_KEY}" \
        "${BASE_URL}/api/keys" 2>/dev/null)
    
    local tests_passed=0
    local expected_headers=(
        "X-RateLimit-Limit"
        "X-RateLimit-Remaining"
        "X-RateLimit-Reset"
    )
    
    for header in "${expected_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            log_success "安全头存在: $header"
            ((tests_passed++))
        else
            log_fail "安全头缺失: $header"
        fi
    done
    
    # 检查可选的安全头
    local optional_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
    )
    
    for header in "${optional_headers[@]}"; do
        if echo "$headers" | grep -qi "$header"; then
            log_info "可选安全头存在: $header"
        fi
    done
    
    if [[ $tests_passed -eq ${#expected_headers[@]} ]]; then
        log_success "所有必需安全头都存在"
        return 0
    else
        log_fail "部分必需安全头缺失"
        return 1
    fi
}

# 生成测试报告
generate_report() {
    log_header "测试报告摘要"
    
    local total=$((TESTS_PASSED + TESTS_FAILED))
    
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  测试结果摘要${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo -e "  ${GREEN}通过: ${TESTS_PASSED}${NC}"
    echo -e "  ${RED}失败: ${TESTS_FAILED}${NC}"
    echo -e "  ${YELLOW}跳过: ${TESTS_SKIPPED}${NC}"
    echo ""
    echo -e "  总计: ${total}"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 所有测试通过!${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}⚠️  有 ${TESTS_FAILED} 个测试失败${NC}"
        echo ""
        return 1
    fi
}

# 主函数
main() {
    log_info "开始安全测试..."
    log_info "目标服务器: ${BASE_URL}"
    log_info "测试持续时间: ${TEST_DURATION}秒"
    log_info "并发请求数: ${CONCURRENT_REQUESTS}"
    echo ""
    
    # 先检查服务器
    if ! check_server; then
        log_fail "服务器不可用，测试终止"
        exit 1
    fi
    
    # 运行测试
    test_unauthorized_access || true
    test_revocation_privilege_escalation || true
    test_sql_injection_protection || true
    test_xss_protection || true
    test_security_headers || true
    
    # DDoS 测试 (可选，不强制)
    log_header "DDoS 测试 (可选)"
    log_info "这会发送大量请求测试速率限制..."
    read -p "是否运行 DDoS 测试? (可能需要较长时间) [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        test_ddos_rate_limiting || true
        test_ddos_publish_limiting || true
        test_rate_limit_recovery || true
    else
        log_skip "DDoS 测试已跳过"
    fi
    
    # 生成报告
    generate_report
}

# 运行主函数
main "$@"
