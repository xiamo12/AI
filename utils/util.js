const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

// 文本归一化（aiDetector 超集版 — 同时处理 markdown 标记和基础清理）
function normalizeText(text) {
  return String(text || '')
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// 分句（保留句末标点的 match 版，比 split 版更精确）
function splitSentences(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const matches = normalized.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [normalized]
  return matches.map((item) => item.trim()).filter(Boolean)
}

module.exports = {
  formatTime,
  clamp,
  normalizeText,
  splitSentences,
}
