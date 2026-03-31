#!/usr/bin/env node

/**
 * 批量更新许可证头年份脚本
 * 
 * 用途：
 * - 将所有源文件中的版权头年份统一为当前年份
 * - 支持 Apache-2.0 许可证格式
 * 
 * 使用方法：
 *   node scripts/update-license-year.js
 */

const fs = require('fs');
const path = require('path');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

// 当前年份
const CURRENT_YEAR = new Date().getFullYear();

// 需要处理的文件扩展名
const TARGET_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// 需要忽略的目录
const IGNORED_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.git',
  'sdk',
];

// 许可证头正则表达式（匹配各种年份格式）
const LICENSE_PATTERNS = [
  // Copyright (c) 202X KirkyX
  /\/\/\s*Copyright\s*\(c\)\s*\d{4}\s*KirkyX/gi,
  // SPDX-License-Identifier: Apache-2.0
  /\/\/\s*SPDX-License-Identifier:\s*Apache-2\.0/gi,
];

/**
 * 查找所有 TypeScript/JavaScript 文件
 */
function findTargetFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过忽略的目录
      if (!IGNORED_DIRS.includes(file)) {
        findTargetFiles(filePath, fileList);
      }
    } else {
      const ext = path.extname(file);
      if (TARGET_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  
  return fileList;
}

/**
 * 更新文件中的许可证头年份
 */
function updateLicenseYear(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // 替换年份
    const updatedContent = content.replace(
      /\/\/\s*Copyright\s*\(c\)\s*(\d{4})\s*KirkyX/gi,
      `// Copyright (c) ${CURRENT_YEAR} KirkyX`
    );
    
    if (originalContent !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf-8');
      return { success: true, changed: true };
    }
    
    return { success: true, changed: false };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 主函数
 */
function main() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}批量更新许可证头年份${colors.reset}`);
  console.log(`${colors.blue}目标年份：${CURRENT_YEAR}${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  // 查找所有目标文件
  const projectRoot = path.join(__dirname, '..');
  const files = findTargetFiles(projectRoot);
  
  console.log(`${colors.cyan}找到 ${files.length} 个源代码文件${colors.reset}\n`);
  
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;
  
  // 处理每个文件
  files.forEach((filePath, index) => {
    const result = updateLicenseYear(filePath);
    
    if (result.success && result.changed) {
      updatedCount++;
      const relativePath = path.relative(projectRoot, filePath);
      console.log(`${colors.green}[${index + 1}/${files.length}] ✅ 已更新：${relativePath}${colors.reset}`);
    } else if (result.success && !result.changed) {
      unchangedCount++;
    } else {
      errorCount++;
      const relativePath = path.relative(projectRoot, filePath);
      console.log(`${colors.red}[${index + 1}/${files.length}] ❌ 失败：${relativePath} - ${result.error}${colors.reset}`);
    }
  });
  
  // 打印统计
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}更新完成！${colors.reset}`);
  console.log(`${colors.green}✅ 已更新：${updatedCount} 个文件${colors.reset}`);
  console.log(`${colors.yellow}⏭️  未变更：${unchangedCount} 个文件${colors.reset}`);
  console.log(`${colors.red}❌ 失败：${errorCount} 个文件${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

// 运行脚本
main();
