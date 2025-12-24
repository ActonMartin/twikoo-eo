/**
 * Twikoo EdgeOne Pages 构建脚本
 * 
 * EdgeOne Pages 会自动处理构建，此脚本用于本地开发测试
 */

const fs = require('fs')
const path = require('path')

const srcDir = __dirname

console.log('Twikoo EdgeOne Pages 项目准备就绪')
console.log('')
console.log('项目结构：')
console.log('  edge-functions/index.js  - Edge Function 主入口（处理 KV 存储）')
console.log('  node-functions/api/notify.js - Node Function 通知服务（处理邮件）')
console.log('')
console.log('部署说明：')
console.log('  1. 在 EdgeOne Pages 控制台创建项目')
console.log('  2. 创建 KV 命名空间并绑定到项目，变量名设为：TWIKOO_KV')
console.log('  3. 推送代码到仓库，自动触发部署')
console.log('')
console.log('本地开发：')
console.log('  运行 edgeone pages dev 启动本地调试服务')
console.log('')

// 检查必要文件
const requiredFiles = [
  'edge-functions/index.js',
  'node-functions/api/notify.js',
  'package.json'
]

let allFilesExist = true
for (const file of requiredFiles) {
  const filePath = path.join(srcDir, file)
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${file}`)
  } else {
    console.log(`✗ ${file} (缺失)`)
    allFilesExist = false
  }
}

if (allFilesExist) {
  console.log('')
  console.log('所有必要文件已就绪！')
} else {
  console.log('')
  console.log('警告：部分文件缺失，请检查项目结构')
  process.exit(1)
}
