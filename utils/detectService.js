const { analyzeArticle } = require('./aiTextDetection')

/**
 * 检测编排：纯本地分析，无远程请求
 */
function runDetection(text, options = {}) {
  const analysis = analyzeArticle(text, options)
  analysis.originalText = text
  analysis.detectMode = 'local'
  return Promise.resolve(analysis)
}

module.exports = {
  runDetection,
}
