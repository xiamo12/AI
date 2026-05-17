/**
 * 批量检测文章 AI 率（使用小程序本地引擎，场景：公众号文章）
 */
const fs = require('fs')
const path = require('path')

process.chdir(path.resolve(__dirname, '..'))

global.wx = {
  getStorageSync() { return '' },
  setStorageSync() {},
  getSystemInfoSync() {
    return { platform: 'devtools', SDKVersion: '3.15.1' }
  },
}

const { analyzeArticle } = require('../utils/aiTextEngine')

const GROUPS = [
  { label: '人工编写/修改（公众号）', dir: '/Users/xiamo/Downloads/文章/公众号文章' },
  { label: '完全 AI 生成', dir: '/Users/xiamo/Downloads/文章/AI生成文章' },
]

function detectFile(filePath, groupLabel) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const result = analyzeArticle(raw, { articleType: '公众号文章' })
  return {
    group: groupLabel,
    file: path.basename(filePath),
    title: result.title,
    score: result.score,
    riskText: result.riskText,
    riskLevel: result.riskLevel,
    wordCount: result.wordCount,
    aiFlavorHits: result.aiFlavorHits,
    confidence: result.confidence,
    topReasons: (result.reasons || []).slice(0, 3),
  }
}

const all = []
for (const { label, dir } of GROUPS) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
  for (const file of files) {
    all.push(detectFile(path.join(dir, file), label))
  }
}

console.log(JSON.stringify(all, null, 2))
