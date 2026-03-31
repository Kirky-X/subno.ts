/**
 * Prettier 配置
 * 
 * 工业级代码格式化标准
 */
module.exports = {
  // 每行最大字符数
  printWidth: 100,
  
  // 使用 2 个空格缩进
  tabWidth: 2,
  useTabs: false,
  
  // 语句末尾加分号
  semi: true,
  
  // 使用单引号
  singleQuote: true,
  
  // 对象属性引号：仅在需要时添加
  quoteProps: 'as-needed',
  
  // JSX 中使用单引号
  jsxSingleQuote: false,
  
  // 尾随逗号：ES5 标准（对象、数组等）
  trailingComma: 'all',
  
  // 对象字面量的大括号间添加空格
  bracketSpacing: true,
  
  // JSX 标签的 > 不另起一行
  bracketSameLine: false,
  
  // 箭头函数单个参数不加括号
  arrowParens: 'avoid',
  
  // 每个文件格式化的范围是整个文件
  rangeStart: 0,
  rangeEnd: Infinity,
  
  // 不需要 @prettier 注释即可格式化
  requirePragma: false,
  
  // 不在文件顶部插入 @format 注释
  insertPragma: false,
  
  // Markdown 文本换行
  proseWrap: 'preserve',
  
  // HTML 空格敏感性
  htmlWhitespaceSensitivity: 'css',
  
  // Vue 文件中 <script> 和 <style> 标签内的代码缩进
  vueIndentScriptAndStyle: false,
  
  // 换行符：LF (Unix/Mac)
  endOfLine: 'lf',
  
  // 格式化嵌入的代码（如 Markdown 中的代码块）
  embeddedLanguageFormatting: 'auto',
  
  // HTML、Vue、JSX 中每个属性独占一行
  singleAttributePerLine: false,
}
