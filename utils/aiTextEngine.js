// aiTextEngine.js — 兼容层
// 从独立模块重新导出页面层所需的函数

const { STORAGE_KEYS, buildHistoryRecord, readHistory, saveHistory, clearHistory } = require('./aiTextHistory')
const { analyzeArticle } = require('./aiTextDetection')
const { runDetection } = require('./detectService')
const { normalizeText } = require('./util')

module.exports = {
  STORAGE_KEYS,
  analyzeArticle,
  runDetection,
  buildHistoryRecord,
  readHistory,
  saveHistory,
  clearHistory,
  normalizeText,
}
