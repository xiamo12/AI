const DEFAULT_CONFIG = {
  enabled: false,
  apiKey: '',
  endpoint: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
}

function getWx() {
  return typeof wx !== 'undefined' ? wx : null
}

function mergeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    endpoint: config.endpoint || DEFAULT_CONFIG.endpoint,
    model: config.model || DEFAULT_CONFIG.model,
  }
}

/**
 * 从本地 storage 读取 DeepSeek 配置。
 *
 * 小程序端保存 API Key 适合个人工具和开发调试；正式发布时建议迁移到云函数代理，
 * 避免 Key 被反编译或抓包暴露。
 */
function readDeepSeekConfig(storageKey) {
  const wxApi = getWx()
  if (!wxApi || !storageKey) return { ...DEFAULT_CONFIG }
  return mergeConfig(wxApi.getStorageSync(storageKey) || {})
}

function saveDeepSeekConfig(storageKey, config) {
  const wxApi = getWx()
  if (!wxApi || !storageKey) return
  wxApi.setStorageSync(storageKey, mergeConfig(config))
}

function maskApiKey(apiKey) {
  const value = String(apiKey || '')
  if (!value) return ''
  if (value.length <= 10) return '已配置'
  return `${value.slice(0, 5)}****${value.slice(-4)}`
}

function stripCodeFence(text) {
  return String(text || '')
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```$/g, '')
    .trim()
}

function buildRewriteMessages(text, options = {}) {
  const scene = options.scene || options.articleType || '通用文本'
  const intensity = options.intensity || 'medium'
  const referenceText = String(options.referenceText || '').trim()
  const intensityText = {
    light: '轻度调整：尽量保留原句结构，只处理明显 AI 味。',
    medium: '中度调整：允许重组句子，让表达更自然，但不改变事实。',
    deep: '深度调整：允许重排语序和段落节奏，提升内容质感与真人表达。',
  }[intensity] || '中度调整：允许重组句子，让表达更自然，但不改变事实。'

  const referenceBlock = referenceText
    ? `\n参考文风：\n${referenceText}\n\n请吸收参考文章的段落节奏、用词习惯和语气，但不要抄参考文章内容。`
    : ''

  return [
    {
      role: 'system',
      content: [
        '你是一名中文资深编辑，任务是把文章改得更像真人自然写作。',
        '不要做机械同义词替换，不要堆砌“其实、后来、说实话”。',
        '必须保留原文事实、核心意思和称呼关系。',
        '要让句子更通顺、有真实语气、有生活阻力感和自然节奏。',
        '输出只能是改写后的正文，不要解释，不要标题，不要 Markdown。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `使用场景：${scene}`,
        `优化强度：${intensityText}`,
        options.preserveMeaning === false ? '可以适度重组表达，但不要改事实。' : '必须保留原意。',
        options.preserveStructure === false ? '可以调整段落结构。' : '尽量保留原有段落层级。',
        referenceBlock,
        '请对下面文章做“去 AI 味”改写。',
        '要求：',
        '1. 不要只改标点或替换几个词。',
        '2. 每个有 AI 味的句子都要做实质性表达调整。',
        '3. 避免“不是……而是……”“本质上”“底层逻辑”“长期主义”等模板表达。',
        '4. 改写后读起来要像一个真实的人写的。',
        '',
        '原文：',
        text,
      ].join('\n'),
    },
  ]
}

/**
 * 调用 DeepSeek Chat Completions。
 *
 * 这里使用非流式请求，便于和现有小程序页面状态衔接。
 */
function requestChatCompletion(messages, config = {}) {
  const wxApi = getWx()
  const finalConfig = mergeConfig(config)
  if (!wxApi || !wxApi.request) return Promise.reject(new Error('wx.request unavailable'))
  if (!finalConfig.apiKey) return Promise.reject(new Error('DeepSeek API Key missing'))

  return new Promise((resolve, reject) => {
    wxApi.request({
      url: finalConfig.endpoint,
      method: 'POST',
      timeout: 60000,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finalConfig.apiKey}`,
      },
      data: {
        model: finalConfig.model,
        messages,
        stream: false,
        temperature: 0.72,
        top_p: 0.9,
        max_tokens: 4096,
      },
      success(response) {
        const status = response.statusCode || 0
        if (status < 200 || status >= 300) {
          reject(new Error(`DeepSeek request failed: ${status}`))
          return
        }
        const content = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content
        if (!content) {
          reject(new Error('DeepSeek empty response'))
          return
        }
        resolve(stripCodeFence(content))
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

function rewriteArticleWithDeepSeek(text, options = {}, config = {}) {
  const messages = buildRewriteMessages(text, options)
  return requestChatCompletion(messages, config)
}

module.exports = {
  DEFAULT_CONFIG,
  readDeepSeekConfig,
  saveDeepSeekConfig,
  maskApiKey,
  buildRewriteMessages,
  rewriteArticleWithDeepSeek,
}
