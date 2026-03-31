#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-floating-promises */

/**
 * 许可证头检查脚本
 * 
 * 用途：
 * - 在 pre-commit 钩子中检查新文件是否包含许可证声明
 * - 确保所有源代码文件都有统一的版权头
 * 
 * 使用方法：
 *   node .husky/check-license.js
 * 
 * 退出码：
 *   0 - 所有文件均包含许可证声明
 *   1 - 有文件缺少许可证声明
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// 许可证头模板（Apache-2.0）
const LICENSE_HEADER = `// SPDX-License-Identifier: Apache-2.0
// Copyright (c) ${new Date().getFullYear()} KirkyX. All rights reserved.`;

// 需要检查的文件扩展名
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

/**
 * 获取暂存的文件列表
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.split('\n').filter(f => f.trim());
  } catch (error) {
    console.error(`${colors.yellow}警告：无法获取暂存文件列表${colors.reset}`);
    return [];
  }
}

/**
 * 检查文件是否应该被忽略
 */
function shouldIgnore(filePath) {
  // 检查扩展名
  const ext = path.extname(filePath);
  if (!TARGET_EXTENSIONS.includes(ext)) {
    return true;
  }

  // 检查目录
  const parts = filePath.split(path.sep);
  return parts.some(part => IGNORED_DIRS.includes(part));
}

/**
 * 检查单个文件是否包含许可证头
 */
function checkFile(filePath) {
  try {
    const absolutePath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
      return true; // 文件不存在，跳过
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');
    
    // 检查前两行是否包含许可证头
    const firstLine = lines[0]?.trim() || '';
    const secondLine = lines[1]?.trim() || '';
    
    // 检查是否包含 SPDX 标识符或版权声明
    const hasSPDX = firstLine.includes('SPDX-License-Identifier') || 
                    secondLine.includes('SPDX-License-Identifier');
    const hasCopyright = firstLine.includes('Copyright') || 
                         secondLine.includes('Copyright');
    
    return hasSPDX && hasCopyright;
  } catch (error) {
    console.error(`${colors.yellow}警告：读取文件失败 ${filePath}: ${error.message}${colors.reset}`);
    return true; // 出错时跳过
  }
}

/**
 * 主函数
 */
function main() {
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log(`${colors.green}✅ 没有暂存文件，跳过许可证检查${colors.reset}`);
    process.exit(0);
  }

  // 过滤出需要检查的文件
  const filesToCheck = stagedFiles.filter(f => !shouldIgnore(f));
  
  if (filesToCheck.length === 0) {
    console.log(`${colors.green}✅ 没有需要检查的源代码文件${colors.reset}`);
    process.exit(0);
  }

  // 检查每个文件
  const failedFiles = filesToCheck.filter(f => !checkFile(f));

  if (failedFiles.length > 0) {
    console.error(`\n${colors.red}❌ 许可证检查失败！${colors.reset}`);
    console.error(`${colors.red}以下 ${failedFiles.length} 个文件缺少许可证声明：${colors.reset}\n`);
    
    failedFiles.forEach((file, index) => {
      console.error(`${colors.cyan}   ${index + 1}. ${file}${colors.reset}`);
    });
    
    console.error(`\n${colors.yellow}请在这些文件的开头添加以下许可证声明：${colors.reset}\n`);
    console.error(`${colors.cyan}${LICENSE_HEADER}${colors.reset}\n`);
    
    console.error(`${colors.yellow}提示：${colors.reset}`);
    console.error('  - 将上述内容添加到文件的第一行和第二行');
    console.error('  - 可以使用 IDE 的代码模板功能自动添加');
    console.error('  - 或者手动复制粘贴到每个文件\n');
    
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ 许可证检查通过：所有 ${filesToCheck.length} 个文件均包含许可证声明${colors.reset}`);
    process.exit(0);
  }
}

// 运行检查
main();
