const TEMPLATE_ROUTES = [
  { test: /长期主义/, build: (text) => text.replace(/长期主义/g, '把一件小事持续做下去的耐心') },
  { test: /底层逻辑/, build: (text) => text.replace(/底层逻辑/g, '背后真正起作用的原因') },
  { test: /本质上/, build: (text) => text.replace(/本质上[，,]?/g, '拆开看，') },
  { test: /破局/, build: (text) => text.replace(/破局/g, '从卡住的地方往前挪一步') },
  { test: /闭环/, build: (text) => text.replace(/闭环/g, '把事情从开始做到有结果') },
  { test: /松弛感/, build: (text) => text.replace(/松弛感/g, '不再一直绷着的状态') },
  { test: /内耗/, build: (text) => text.replace(/内耗/g, '自己跟自己较劲') },
  { test: /情绪价值/, build: (text) => text.replace(/情绪价值/g, '让人待在一起舒服的感觉') },
]

function cleanup(text) {
  return String(text || '').replace(/\s+/g, '').replace(/，。/g, '。').trim()
}

function ensureEnd(text) {
  const value = cleanup(text)
  return value && !/[。！？!?]$/.test(value) ? `${value}。` : value
}

/**
 * antiTemplate
 *
 * 降低高频模板词的存在感。
 * 这里不是把词机械删除，而是把“概念标签”改成“人能看见的说法”，
 * 让句子从口号回到可理解的日常表达。
 */
function apply(sentence) {
  let text = cleanup(sentence)
  if (!text) return text

  TEMPLATE_ROUTES.forEach((route) => {
    if (route.test.test(text)) text = route.build(text)
  })

  text = text
    .replace(/在当今社会[，,]?/g, '这几年，')
    .replace(/随着时代的发展[，,]?/g, '这几年变化很快，')
    .replace(/可以说[，,]?/g, '')
    .replace(/值得注意的是[，,]?/g, '有个细节我后来才注意到，')
    .replace(/综上所述[，,]?/g, '回头看，')
    .replace(/总而言之[，,]?/g, '说简单点，')

  if (/真正[^。！？；;]{0,18}的人/.test(text)) {
    text = text.replace(/真正[^，。！？；;]{0,18}的人/g, '那些能把事情做久的人')
  }

  return ensureEnd(text)
}

module.exports = {
  name: 'antiTemplate',
  apply,
}
