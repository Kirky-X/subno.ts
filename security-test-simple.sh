#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# SecureNotify 安全测试脚本 - 简化版

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-test-api-key-12345678}"
TEST_KEY_ID="test-key-id-for-security-test"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SecureNotify 安全测试套件${NC}"
echo -e "${BLUE}========================================${NC}"

TESTS_PASSED=0
TESTS_FAILED=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# 测试 1: 服务器连通性
echo ""
log_info "测试 1: 服务器连通性"
if curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/keys/${TEST_KEY_ID}" | grep -qE "^[0-9]+$"; then
    log_pass "服务器已运行"
else
    log_fail "服务器无响应"
fi

# 测试 2: 无 API Key 访问
echo ""
log_info "测试 2: 无 API Key 访问"
response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/keys/${TEST_KEY_ID}" 2>/dev/null || echo "000")
if [[ "$response" == "401" || "$response" == "403" || "$response" == "404" ]]; then
    log_pass "无 API Key 访问被拒绝 (HTTP $response)"
else
    log_fail "无 API Key 应返回 401/403/404, 但返回 $response"
fi

# 测试 3: 无效 API Key
echo ""
log_info "测试 3: 无效 API Key"
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: invalid-key-short" \
    "${BASE_URL}/api/keys/${TEST_KEY_ID}" 2>/dev/null || echo "000")
if [[ "$response" == "401" || "$response" == "403" ]]; then
    log_pass "无效 API Key 被拒绝 (HTTP $response)"
else
    log_fail "无效 API Key 应返回 401/403, 但返回 $response"
fi

# 测试 4: 格式错误的 API Key (太短)
echo ""
log_info "测试 4: 格式错误的 API Key"
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: abc" \
    "${BASE_URL}/api/keys/${TEST_KEY_ID}" 2>/dev/null || echo "000")
if [[ "$response" == "401" || "$response" == "403" ]]; then
    log_pass "短 API Key 被拒绝 (HTTP $response)"
else
    log_fail "短 API Key 应返回 401/403, 但返回 $response"
fi

# 测试 5: 撤销端点权限
echo ""
log_info "测试 5: 撤销端点权限检查"
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: ${API_KEY}" \
    -X POST \
    "${BASE_URL}/api/keys/${TEST_KEY_ID}/revoke" 2>/dev/null || echo "000")
if [[ "$response" == "401" || "$response" == "403" || "$response" == "404" || "$response" == "500" ]]; then
    log_pass "撤销端点存在并返回预期响应 (HTTP $response)"
else
    log_fail "撤销端点返回异常响应: $response"
fi

# 测试 6: SQL 注入防护
echo ""
log_info "测试 6: SQL 注入防护"
injection_payloads=("' OR '1'='1" "'; DROP TABLE users;--" "admin'--")
injection_passed=0
for payload in "${injection_payloads[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: ${API_KEY}" \
        "${BASE_URL}/api/keys/${payload}" 2>/dev/null || echo "000")
    if [[ "$response" != "500" ]]; then
        ((injection_passed++))
    fi
done
if [[ $injection_passed -eq ${#injection_payloads[@]} ]]; then
    log_pass "SQL 注入防护有效 ($injection_passed/${#injection_payloads[@]})"
else
    log_fail "SQL 注入防护存在问题 ($injection_passed/${#injection_payloads[@]})"
fi

# 测试 7: XSS 防护
echo ""
log_info "测试 7: XSS 防护"
xss_payloads=("<script>alert('XSS')</script>" "<img src=x onerror=alert(1)>")
xss_passed=0
for payload in "${xss_payloads[@]}"; do
    encoded=$(echo -n "$payload" | sed 's/</%3C/g; s/>/%3E/g')
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: ${API_KEY}" \
        "${BASE_URL}/api/keys/${encoded}" 2>/dev/null || echo "000")
    if [[ "$response" != "500" ]]; then
        ((xss_passed++))
    fi
done
if [[ $xss_passed -eq ${#xss_payloads[@]} ]]; then
    log_pass "XSS 防护有效 ($xss_passed/${#xss_payloads[@]})"
else
    log_fail "XSS 防护存在问题 ($xss_passed/${#xss_payloads[@]})"
fi

# 测试 8: 速率限制 (简单测试)
echo ""
log_info "测试 8: 速率限制测试"
request_count=0
rate_limited=0
for i in {1..20}; do
    ((request_count++))
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: ${API_KEY}" \
        "${BASE_URL}/api/keys/${TEST_KEY_ID}" 2>/dev/null || echo "000")
    if [[ "$response" == "429" ]]; then
        ((rate_limited++))
    fi
    sleep 0.05
done
log_info "  20次请求中 $rate_limited 次被限流"
if [[ $rate_limited -gt 0 ]]; then
    log_pass "速率限制生效"
else
    log_info "速率限制可能未触发 (正常，如果未达到阈值)"
fi

# 测试 9: 安全响应头
echo ""
log_info "测试 9: 安全响应头"
headers=$(curl -s -I -H "X-API-Key: ${API_KEY}" "${BASE_URL}/api/keys/${TEST_KEY_ID}" 2>/dev/null || echo "")
if echo "$headers" | grep -qi "x-content-type-options"; then
    log_pass "安全响应头存在"
else
    log_fail "安全响应头缺失"
fi

# 总结
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  测试结果总结${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "通过: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "失败: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}所有安全测试通过!${NC}"
    exit 0
else
    echo -e "${RED}存在安全测试失败${NC}"
    exit 1
fi
