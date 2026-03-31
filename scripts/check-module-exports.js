#!/usr/bin/env node

/**
 * 模块导出安全检查工具
 * 
 * 用途：
 * 1. 检测不当的 export * 语句
 * 2. 检查导出的函数是否有 JSDoc 文档
 * 3. 识别可能泄露的内部实现
 * 4. 统计导出数量，监控 API 表面增长
 * 
 * 使用方法：
 *   npm run check-exports
 *   node scripts/check-module-exports.js
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 配置
const config = {
  // 要检查的目录
  srcDir: path.join(__dirname, '..', 'src'),
  sdkDir: path.join(__dirname, '..', 'sdk', 'typescript', 'src'),
  
  // 忽略的文件/目录模式
  ignorePatterns: [
    /\/node_modules\//,
    /\/\.next\//,
    /\/dist\//,
    /\/build\//,
    /\.test\.ts$/,
    /\.spec\.ts$/,
    /\/__tests__\//,
  ],
  
  // 允许使用 export * 的文件（白名单）
  allowExportStar: [
    'types/index.ts',
    'types/api.ts',
  ],
  
  // 最大导出数量警告阈值
  maxExportsPerFile: 20,
};

// 问题统计
const issues = {
  errors: [],
  warnings: [],
  suggestions: [],
};

/**
 * 检查文件是否应该被忽略
 */
function shouldIgnore(filePath) {
  return config.ignorePatterns.some(pattern => pattern.test(filePath));
}

/**
 * 查找所有 TypeScript 文件
 */
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!shouldIgnore(filePath)) {
        findTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !shouldIgnore(filePath)) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * 分析单个文件的导出
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
    
    const relativePath = path.relative(path.join(__dirname, '..'), filePath);
    const fileName = path.basename(filePath);
    
    let exportCount = 0;
    let hasExportStar = false;
    
    // 遍历 AST
    ts.forEachChild(sourceFile, node => {
      // 检查 export * 语句
      if (ts.isExportDeclaration(node)) {
        if (!node.moduleSpecifier) {
          // export * from './something'
          hasExportStar = true;
          
          const isAllowed = config.allowExportStar.some(allowed => 
            filePath.endsWith(allowed)
          );
          
          if (!isAllowed) {
            issues.errors.push({
              file: relativePath,
              line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
              message: "使用 'export *' 会暴露所有内部实现，应明确列出导出的内容",
              code: 'EXPORT_STAR',
            });
          }
        }
        
        exportCount++;
      }
      
      // 检查导出的函数/类
      if (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
        node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        exportCount++;
        
        // 检查是否有 JSDoc 注释
        const jsDocComments = ts.getJSDocCommentsAndTags(node);
        if (jsDocComments.length === 0) {
          const name = node.name?.getText(sourceFile) || 'anonymous';
          issues.warnings.push({
            file: relativePath,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            message: `导出的 ${node.kind === ts.SyntaxKind.FunctionDeclaration ? '函数' : '类'} '${name}' 缺少 JSDoc 文档`,
            code: 'MISSING_JSDOC',
          });
        }
        
        // 检查命名模式（以下划线开头的可能是私有方法）
        if (node.name && node.name.getText(sourceFile).startsWith('_')) {
          issues.suggestions.push({
            file: relativePath,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            message: `导出的标识符 '${node.name.getText(sourceFile)}' 以下划线开头，可能是内部实现`,
            code: 'INTERNAL_EXPORT',
          });
        }
      }
      
      // 检查导出的变量
      if (ts.isVariableStatement(node)) {
        const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        if (isExported) {
          exportCount++;
          
          // 检查是否是常量配置对象
          const declarations = node.declarationList.declarations;
          for (const decl of declarations) {
            if (decl.name.getText(sourceFile).includes('CONFIG') || 
                decl.name.getText(sourceFile).includes('config')) {
              issues.suggestions.push({
                file: relativePath,
                line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                message: '导出的配置对象应该使用 Object.freeze() 防止篡改',
                code: 'UNFROZEN_CONFIG',
              });
            }
          }
        }
      }
    });
    
    // 检查导出数量
    if (exportCount > config.maxExportsPerFile) {
      issues.warnings.push({
        file: relativePath,
        line: 1,
        message: `文件导出了 ${exportCount} 个符号，超过阈值 ${config.maxExportsPerFile}。考虑拆分模块或减少导出`,
        code: 'TOO_MANY_EXPORTS',
      });
    }
    
    return { exportCount, hasExportStar };
  } catch (error) {
    issues.errors.push({
      file: filePath,
      line: 0,
      message: `解析文件失败：${error.message}`,
      code: 'PARSE_ERROR',
    });
    return { exportCount: 0, hasExportStar: false };
  }
}

/**
 * 打印报告
 */
function printReport(fileStats) {
  console.log('\n' + colors.cyan + '='.repeat(80) + colors.reset);
  console.log(colors.cyan + '模块导出安全检查报告' + colors.reset);
  console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');
  
  // 文件统计
  console.log(colors.blue + '📊 文件统计:' + colors.reset);
  console.log(`   检查了 ${fileStats.length} 个文件`);
  console.log(`   总导出数量：${fileStats.reduce((sum, s) => sum + s.exports, 0)}`);
  console.log(`   使用 export * 的文件：${fileStats.filter(s => s.hasStar).length}\n`);
  
  // 错误
  if (issues.errors.length > 0) {
    console.log(colors.red + '❌ 错误 (' + issues.errors.length + '):' + colors.reset);
    issues.errors.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${colors.red}${issue.file}:${issue.line}${colors.reset}`);
      console.log(`      ${issue.message}`);
      console.log(`      代码：${issue.code}\n`);
    });
  } else {
    console.log(colors.green + '✅ 没有发现错误' + colors.reset + '\n');
  }
  
  // 警告
  if (issues.warnings.length > 0) {
    console.log(colors.yellow + '⚠️  警告 (' + issues.warnings.length + '):' + colors.reset);
    issues.warnings.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${colors.yellow}${issue.file}:${issue.line}${colors.reset}`);
      console.log(`      ${issue.message}`);
      console.log(`      代码：${issue.code}\n`);
    });
  }
  
  // 建议
  if (issues.suggestions.length > 0) {
    console.log(colors.magenta + '💡 建议 (' + issues.suggestions.length + '):' + colors.reset);
    issues.suggestions.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${colors.magenta}${issue.file}:${issue.line}${colors.reset}`);
      console.log(`      ${issue.message}`);
      console.log(`      代码：${issue.code}\n`);
    });
  }
  
  // 总结
  console.log(colors.cyan + '='.repeat(80) + colors.reset);
  
  if (issues.errors.length === 0 && issues.warnings.length === 0) {
    console.log(colors.green + '✨ 所有检查通过！代码质量很好！' + colors.reset);
    console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');
    process.exit(0);
  } else {
    console.log(colors.yellow + '📝 需要修复的问题:' + colors.reset);
    console.log(`   - 错误：${issues.errors.length} 个（必须修复）`);
    console.log(`   - 警告：${issues.warnings.length} 个（建议修复）`);
    console.log(`   - 建议：${issues.suggestions.length} 个（可选优化）`);
    console.log(colors.cyan + '='.repeat(80) + colors.reset + '\n');
    
    // 如果有错误，退出码为 1
    if (issues.errors.length > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

/**
 * 生成 JSON 报告（用于 CI/CD）
 */
function generateJsonReport(fileStats) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      filesChecked: fileStats.length,
      totalExports: fileStats.reduce((sum, s) => sum + s.exports, 0),
      filesWithExportStar: fileStats.filter(s => s.hasStar).length,
      errors: issues.errors.length,
      warnings: issues.warnings.length,
      suggestions: issues.suggestions.length,
    },
    issues: {
      errors: issues.errors,
      warnings: issues.warnings,
      suggestions: issues.suggestions,
    },
  };
  
  const outputPath = path.join(__dirname, 'export-check-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\nJSON 报告已保存到：${outputPath}`);
}

/**
 * 主函数
 */
function main() {
  console.log(colors.blue + '🔍 开始检查模块导出...\n' + colors.reset);
  
  // 查找所有 TypeScript 文件
  const tsFiles = [
    ...findTsFiles(config.srcDir),
    ...findTsFiles(config.sdkDir),
  ];
  
  console.log(`找到 ${tsFiles.length} 个 TypeScript 文件\n`);
  
  // 分析每个文件
  const fileStats = tsFiles.map(filePath => {
    const result = analyzeFile(filePath);
    return {
      path: filePath,
      exports: result.exportCount,
      hasStar: result.hasExportStar,
    };
  });
  
  // 打印报告
  printReport(fileStats);
  
  // 生成 JSON 报告
  generateJsonReport(fileStats);
}

// 运行检查
main();
