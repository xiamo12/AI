// aiTextHistory.js — 历史记录管理
// 从 aiTextEngine.js 拆出的独立模块

const STORAGE_KEYS = {
  currentAnalysis: 'ai_text_lab_current_analysis',
  currentOptimize: 'ai_text_lab_current_optimize',
  history: 'ai_text_lab_history',
  deepSeekConfig: 'ai_text_lab_deepseek_config',
}

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now())
  const pad = (num) => String(num).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildHistoryRecord(payload) {
  const now = Date.now()
  return {
    id: `record_${now}`,
    type: payload.type || 'detect',
    title: payload.title || '未命名文章',
    score: payload.score || 0,
    afterScore: payload.afterScore || 0,
    wordCount: payload.wordCount || 0,
    scene: payload.scene || '通用文本',
    status: payload.type === 'optimize' ? '优化完成' : '检测完成',
    time: formatTime(now),
    createdAt: now,
    analysis: payload.analysis || null,
    optimize: payload.optimize || null,
  }
}

function readHistory() {
  return wx.getStorageSync(STORAGE_KEYS.history) || []
}

function saveHistory(record) {
  const list = readHistory()
  wx.setStorageSync(STORAGE_KEYS.history, [record].concat(list).slice(0, 30))
}

module.exports = {
  STORAGE_KEYS,
  buildHistoryRecord,
  readHistory,
  saveHistory,
}
