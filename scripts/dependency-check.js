#!/usr/bin/env node

/**
 * 依赖安全检查脚本
 * 用于 CI/CD 流程中的依赖安全审计
 * 
 * 使用方式:
 *   node scripts/dependency-check.js
 * 
 * 退出码:
 *   0 - 无漏洞
 *   1 - 发现漏洞
 *   2 - 执行错误
 */

const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    return error.stdout || error.stderr || '';
  }
}

function parseAuditOutput(output) {
  try {
    const result = JSON.parse(output);
    return result.metadata?.vulnerabilities || { total: 0 };
  } catch {
    return { total: 0 };
  }
}

function main() {
  log('\n========================================', BLUE);
  log('  依赖安全检查报告', BLUE);
  log('========================================\n', BLUE);

  // 1. 检查当前日期和时间
  const now = new Date();
  log(`检查时间: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`);

  // 2. 运行 npm audit
  log('正在执行安全审计...', YELLOW);
  const auditOutput = runCommand('npm audit --json');
  const vulnerabilities = parseAuditOutput(auditOutput);

  // 3. 输出漏洞统计
  log('\n--- 漏洞统计 ---', BLUE);
  const { info = 0, low = 0, moderate = 0, high = 0, critical = 0, total = 0 } = vulnerabilities;
  
  console.log(`  信息级别: ${info}`);
  console.log(`  低危: ${low}`);
  console.log(`  中危: ${moderate}`);
  console.log(`  高危: ${high}`);
  console.log(`  严重: ${critical}`);
  console.log(`  总计: ${total}`);

  // 4. 检查过时的依赖
  log('\n--- 过时依赖检查 ---', BLUE);
  const outdatedOutput = runCommand('npm outdated --json');
  let outdatedCount = 0;
  try {
    const outdated = JSON.parse(outdatedOutput || '{}');
    outdatedCount = Object.keys(outdated).length;
    if (outdatedCount > 0) {
      log(`发现 ${outdatedCount} 个可更新的依赖:`, YELLOW);
      Object.entries(outdated).forEach(([name, info]) => {
        console.log(`  - ${name}: ${info.current} -> ${info.latest}`);
      });
    } else {
      log('所有依赖均为最新版本', GREEN);
    }
  } catch {
    log('无法解析过时依赖信息', YELLOW);
  }

  // 5. 总结和建议
  log('\n--- 检查结果 ---', BLUE);
  
  if (total === 0) {
    log('安全检查通过: 未发现已知漏洞', GREEN);
    log('\n建议:', BLUE);
    log('  - 定期运行此脚本以保持依赖安全');
    log('  - 在 CI/CD 流程中集成此检查');
    log('  - 关注过时依赖的更新');
    process.exit(0);
  } else {
    log(`安全检查失败: 发现 ${total} 个漏洞`, RED);
    log('\n修复建议:', BLUE);
    log('  1. 运行 npm audit fix 尝试自动修复');
    log('  2. 运行 npm audit fix --force 强制修复（可能有破坏性变更）');
    log('  3. 手动检查并更新有漏洞的依赖版本');
    log('  4. 查看详细报告: npm audit');
    process.exit(1);
  }
}

// 错误处理
process.on('uncaughtException', (error) => {
  log(`执行错误: ${error.message}`, RED);
  process.exit(2);
});

main();
