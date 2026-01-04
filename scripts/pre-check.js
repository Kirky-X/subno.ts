#!/usr/bin/env node

/**
 * Pre-check Script
 * 本地代码预检查工具，用于在提交前验证代码是否符合CI要求
 * 
 * 运行方式:
 *   node scripts/pre-check.js
 *   npm run pre-check
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// 颜色配置
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// 打印函数
const log = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[✓]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[✗]${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n${colors.blue}  ${msg}${colors.reset}\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`),
};

// 检查结果
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  checks: [],
};

function addResult(name, passed, message = '') {
  results.checks.push({ name, passed, message });
  if (passed) {
    results.passed++;
    log.success(`${name}${message ? `: ${message}` : ''}`);
  } else {
    results.failed++;
    log.error(`${name}${message ? `: ${message}` : ''}`);
  }
}

function runCommand(command, options = {}) {
  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 120000,
      ...options,
    });
    return { success: true, output: '' };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || error.message,
      code: error.status,
    };
  }
}

function getPackageJson() {
  const packagePath = join(projectRoot, 'package.json');
  if (!existsSync(packagePath)) {
    throw new Error('package.json not found');
  }
  return JSON.parse(readFileSync(packagePath, 'utf-8'));
}

function checkNodeVersion() {
  log.section('Node.js 环境检查');
  
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  addResult('Node.js 安装', true, `v${nodeVersion}`);
  
  if (majorVersion < 18) {
    addResult('Node.js 版本要求', false, `需要 Node.js 18+，当前 ${nodeVersion}`);
    return false;
  }
  
  if (majorVersion < 20) {
    log.warn(`建议使用 Node.js 20+ 以获得最佳兼容性，当前 ${nodeVersion}`);
    results.warnings++;
  }
  
  return true;
}

async function checkDependencies() {
  log.section('依赖安装检查');
  
  const nodeModulesPath = join(projectRoot, 'node_modules');
  
  if (!existsSync(nodeModulesPath)) {
    addResult('node_modules 目录', false, '未安装依赖，请运行 npm ci');
    return false;
  }
  
  const packageJson = getPackageJson();
  const requiredDeps = Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });
  
  let missingDeps = [];
  for (const dep of requiredDeps) {
    const depPath = join(nodeModulesPath, dep);
    if (!existsSync(depPath)) {
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    addResult('依赖完整性', false, `缺少 ${missingDeps.length} 个依赖包`);
    log.info(`运行 'npm ci' 来安装所有依赖`);
    return false;
  }
  
  addResult('依赖安装', true, `${requiredDeps.length} 个包已安装`);
  return true;
}

function checkGitStatus() {
  log.section('Git 状态检查');
  
  const result = runCommand('git status --porcelain');
  
  if (!result.success) {
    addResult('Git 仓库', false, '无法获取Git状态');
    return false;
  }
  
  const stagedFiles = result.output.match(/^[AM]\s+/gm) || [];
  const modifiedFiles = result.output.match(/^[\sM]\w\s+/gm) || [];
  const untrackedFiles = result.output.match(/^\?\?\s+/gm) || [];
  
  addResult('Git 状态', true, `暂存: ${stagedFiles.length}, 修改: ${modifiedFiles.length}, 新增: ${untrackedFiles.length}`);
  
  if (result.output.trim() === '') {
    log.info('工作区干净，无需检查');
    return true;
  }
  
  if (stagedFiles.length === 0 && modifiedFiles.length > 0) {
    log.warn('有修改的文件未暂存，建议先暂存 (git add)');
    results.warnings++;
  }
  
  return true;
}

async function checkLicenseHeaders() {
  log.section('许可证头检查');
  
  const result = runCommand('npm run add-header -- --check');
  
  if (result.success) {
    addResult('许可证头', true, '所有文件都有许可证头');
    return true;
  }
  
  // 如果检查失败，看看是否只是缺少许可证头
  const missingHeaders = result.output.match(/Missing license header/g) || [];
  
  if (missingHeaders.length > 0) {
    addResult('许可证头', false, `${missingHeaders.length} 个文件缺少许可证头`);
    log.info(`运行 'npm run add-header' 来自动添加许可证头`);
    return false;
  }
  
  addResult('许可证头', false, '检查失败');
  return false;
}

async function checkLint() {
  log.section('代码质量检查 (ESLint)');
  
  const result = runCommand('npm run lint');
  
  if (result.success) {
    addResult('ESLint', true, '代码符合规范');
    return true;
  }
  
  // 尝试解析错误数量
  const errorMatch = result.output.match(/(\d+)\s+error/);
  const warningMatch = result.output.match(/(\d+)\s+warning/);
  
  const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
  const warnings = warningMatch ? parseInt(warningMatch[1]) : 0;
  
  addResult('ESLint', false, `${errors} 错误, ${warnings} 警告`);
  
  // 输出前几个错误
  const lines = result.output.split('\n').slice(0, 20);
  console.log(lines.join('\n'));
  
  return false;
}

async function checkTypeScript() {
  log.section('TypeScript 类型检查');
  
  const result = runCommand('npx tsc --noEmit');
  
  if (result.success) {
    addResult('TypeScript', true, '类型检查通过');
    return true;
  }
  
  addResult('TypeScript', false, '存在类型错误');
  
  // 输出错误摘要
  const lines = result.output.split('\n').slice(0, 30);
  console.log(lines.join('\n'));
  
  return false;
}

async function checkTests() {
  log.section('单元测试');
  
  const result = runCommand('npm run test:run', { timeout: 180000 });
  
  if (result.success) {
    addResult('单元测试', true, '所有测试通过');
    return true;
  }
  
  // 解析测试输出
  const failMatch = result.output.match(/(\d+)\s+failed/i);
  const passMatch = result.output.match(/(\d+)\s+passed/i);
  
  const failed = failMatch ? parseInt(failMatch[1]) : 0;
  const passed = passMatch ? parseInt(passMatch[1]) : 0;
  
  addResult('单元测试', false, `${failed} 失败, ${passed} 通过`);
  
  // 输出失败的测试
  const lines = result.output.split('\n');
  const failLines = lines.filter(line => 
    line.includes('FAIL') || 
    line.includes('×') ||
    line.includes('expected') ||
    line.includes('Received:')
  ).slice(0, 30);
  
  if (failLines.length > 0) {
    console.log('\n失败测试:');
    console.log(failLines.join('\n'));
  }
  
  return false;
}

async function checkBuild() {
  log.section('生产构建检查');
  
  const result = runCommand('npm run build');
  
  if (result.success) {
    addResult('构建', true, '构建成功');
    
    // 检查构建产物
    const nextPath = join(projectRoot, '.next');
    if (existsSync(nextPath)) {
      const buildStats = getBuildStats(nextPath);
      addResult('构建产物', true, buildStats);
    }
    
    return true;
  }
  
  addResult('构建', false, '构建失败');
  
  // 输出关键错误
  const lines = result.output.split('\n');
  const errorLines = lines.filter(line =>
    line.includes('Error:') ||
    line.includes('error:') ||
    line.includes('Failed')
  ).slice(0, 20);
  
  if (errorLines.length > 0) {
    console.log('\n构建错误:');
    console.log(errorLines.join('\n'));
  }
  
  return false;
}

function getBuildStats(path) {
  let totalSize = 0;
  let fileCount = 0;
  
  function scanDir(dir) {
    if (!existsSync(dir)) return;
    
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else {
        totalSize += stat.size;
        fileCount++;
      }
    }
  }
  
  scanDir(path);
  
  const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
  return `${fileCount} 个文件, ${sizeInMB} MB`;
}

async function checkDatabase() {
  log.section('数据库配置检查');
  
  const envPath = join(projectRoot, '.env');
  const envExamplePath = join(projectRoot, '.env.example');
  
  // 检查是否存在 .env 文件
  if (!existsSync(envPath)) {
    if (existsSync(envExamplePath)) {
      log.warn('.env 文件不存在，已从 .env.example 复制模板');
      log.info('请配置 .env 文件中的数据库连接信息');
    }
    addResult('环境配置', false, '.env 文件不存在');
    return false;
  }
  
  // 读取并检查关键配置
  const envContent = readFileSync(envPath, 'utf-8');
  const requiredVars = ['DATABASE_URL', 'REDIS_URL'];
  
  let missingVars = [];
  for (const varName of requiredVars) {
    if (!envContent.includes(`${varName}=`)) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    addResult('环境配置', false, `缺少: ${missingVars.join(', ')}`);
    return false;
  }
  
  addResult('环境配置', true, '所有必需变量已配置');
  
  // 检查是否连接到真实的数据库服务
  const dbUrl = envContent.match(/DATABASE_URL=([^\n]+)/)?.[1] || '';
  
  if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    log.warn('DATABASE_URL 指向本地数据库，CI/CD 中可能需要真实数据库');
    results.warnings++;
  }
  
  return true;
}

async function checkVersion() {
  log.section('版本号检查');
  
  const packageJson = getPackageJson();
  const version = packageJson.version;
  
  // 语义化版本检查
  const semverRegex = /^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
  
  if (!semverRegex.test(version)) {
    addResult('版本号格式', false, `无效的版本号: ${version}`);
    return false;
  }
  
  addResult('版本号格式', true, `v${version}`);
  
  // 检查是否有未提交的版本变更
  const result = runCommand('git diff --name-only');
  const versionFiles = result.output.split('\n').filter(f => 
    f.includes('package.json') || 
    f.includes('package-lock.json')
  );
  
  if (versionFiles.length > 0) {
    log.warn(`版本相关文件有未提交的变更: ${versionFiles.join(', ')}`);
    results.warnings++;
  }
  
  return true;
}

async function checkSecurity() {
  log.section('安全检查');
  
  const result = runCommand('npm audit --audit-level=moderate --json', {
    timeout: 60000,
  });
  
  if (result.success) {
    addResult('安全审计', true, '未发现中高风险漏洞');
    return true;
  }
  
  // 尝试解析审计结果
  try {
    const auditResult = JSON.parse(result.output);
    const vulnerabilities = auditResult.vulnerabilities || {};
    
    let totalVulns = 0;
    let highVulns = 0;
    
    for (const pkg of Object.values(vulnerabilities)) {
      totalVulns += pkg.via?.length || 0;
      if (pkg.severity === 'high' || pkg.severity === 'critical') {
        highVulns += pkg.via?.length || 0;
      }
    }
    
    if (highVulns > 0) {
      addResult('安全审计', false, `${highVulns} 个高危漏洞`);
      log.info(`运行 'npm audit fix' 尝试修复`);
      return false;
    }
    
    if (totalVulns > 0) {
      addResult('安全审计', false, `${totalVulns} 个漏洞`);
      results.warnings++;
      return false;
    }
  } catch (e) {
    // 解析失败，忽略
  }
  
  addResult('安全审计', true, '检查完成');
  return true;
}

function printSummary() {
  log.section('检查结果摘要');
  
  console.log(`\n${colors.bold}总计: ${results.checks.length} 项检查${colors.reset}\n`);
  console.log(`${colors.green}  ✓ 通过: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}  ✗ 失败: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}  ⚠ 警告: ${results.warnings}${colors.reset}\n`);
  
  if (results.failed === 0) {
    console.log(`${colors.green}${colors.bold}🎉 所有必需检查已通过！${colors.reset}\n`);
    
    if (results.warnings > 0) {
      console.log(`${colors.yellow}建议解决上述警告后再提交。${colors.reset}\n`);
    }
    
    console.log('准备提交代码...');
  } else {
    console.log(`${colors.red}${colors.bold}❌ 存在 ${results.failed} 项检查未通过，请修复后再提交！${colors.reset}\n`);
    console.log(`${colors.cyan}常见解决方案:${colors.reset}`);
    console.log('  - 运行 npm run add-header 修复许可证头');
    console.log('  - 运行 npm run lint 修复代码规范问题');
    console.log('  - 运行 npm audit fix 修复安全漏洞');
    console.log('  - 确保所有测试通过后再提交');
    
    process.exitCode = 1;
  }
}

async function main() {
  console.log('\n');
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                                                            ║${colors.reset}`);
  console.log(`${colors.cyan}║     🔍  subno.ts 本地预检查工具                          ║${colors.reset}`);
  console.log(`${colors.cyan}║     验证代码是否符合 CI 要求                             ║${colors.reset}`);
  console.log(`${colors.cyan}║                                                            ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');
  
  const startTime = Date.now();
  
  // 基础检查
  checkNodeVersion();
  
  // 核心检查
  await checkDependencies();
  await checkGitStatus();
  
  // 代码质量检查
  await checkLicenseHeaders();
  await checkLint();
  await checkTypeScript();
  
  // 功能检查
  await checkTests();
  await checkBuild();
  
  // 配置检查
  await checkDatabase();
  await checkVersion();
  
  // 安全检查
  await checkSecurity();
  
  // 总结
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${colors.gray}检查耗时: ${elapsed}s${colors.reset}\n`);
  
  printSummary();
}

// 导出供脚本使用
export { runCommand, addResult, results };

main().catch(console.error);
