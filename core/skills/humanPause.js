const PAUSES = ['其实', '后来', '有时候', '说实话', '我以前也这样']

function cleanup(text) {
  return String(text || '').replace(/\s+/g, '').trim()
}

function ensureEnd(text) {
  const value = cleanup(text)
  return value && !/[。！？!?]$/.test(value) ? `${value}。` : value
}

/**
 * 加权随机选取一个未使用过的停顿词，避免 5 句一轮回的模板感。
 * 权重暂取平均，后续可按效果调优。
 */
function pickPause(context = {}) {
  context.usedPauses = context.usedPauses || []
  let available = PAUSES.filter((p) => !context.usedPauses.includes(p))
  if (available.length === 0) {
    context.usedPauses = []
    available = PAUSES
  }
  const idx = Math.floor(Math.random() * available.length)
  const picked = available[idx]
  context.usedPauses.push(picked)
  return picked
}

/**
 * humanPause
 *
 * 加入真实停顿，但保持克制。
 * 真实语言里会有“其实、后来、有时候”这样的缓冲，
 * 过量会变油腻，所以每句只允许很轻的一次介入。
 */
function apply(sentence, analysis = {}, context = {}) {
  const text = cleanup(sentence)
  if (!text) return text
  if (/^(其实|后来|有时候|说实话|我以前也这样)/.test(text)) return ensureEnd(text)
  if (/^(我平时|我会|你应该也有过|那天晚上|写到这里的时候|翻评论区时|和朋友聊起这件事时)/.test(text)) return ensureEnd(text)
  const pause = pickPause(context)

  if (pause === '我以前也这样') {
    return ensureEnd(`${pause}，${text.replace(/[。！？!?]$/, '')}`)
  }

  return ensureEnd(`${pause}，${text.replace(/[。！？!?]$/, '')}`)
}

module.exports = {
  name: 'humanPause',
  apply,
}
