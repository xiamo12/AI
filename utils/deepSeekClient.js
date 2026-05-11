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
 * 小程序端保存 API Key 适合个人工具和开发调试;正式发布时建议迁移到云函数代理,
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
    light: '轻度调整:尽量保留原句结构,只处理明显 AI 味。',
    medium: '中度调整:允许重组句子,让表达更自然,但不改变事实。',
    deep: '深度调整:允许重排语序和段落节奏,提升内容质感与真人表达。',
  }[intensity] || '中度调整:允许重组句子,让表达更自然,但不改变事实。'

  const referenceBlock = referenceText
    ? `\n参考文风:\n${referenceText}\n\n请吸收参考文章的段落节奏、用词习惯和语气,但不要抄参考文章内容。`
    : ''

  return [
    {
      role: 'system',
      content: [
        '你是一名中文资深编辑,任务是把 AI 痕迹的文章改得像真人自然写作。',
        '',
        '【必须做到的 5 条正面要求】',
        '1. 有阻力感:结果不能来得太轻松,对话里要有犹豫、停顿、反复,像真实人的思考过程。',
        '2. 有具体落脚点:不用大词贴标签,每句都像刚刚掉进了某个真实场景。',
        '3. 句式长短错落:短句占七成,长句减量;段落之间节奏要有变化。',
        '4. 有真实情绪:给人"这是活人写出来的"的感觉,而不是"这是一个完美的分析"。',
        '5. 不用总结口吻:不要用"总之""说到底""值得注意的是"这类收束语,让内容自然收束。',
        '',
        '【绝对禁止的 5 条负面约束】',
        '1. 不要机械替换词--把词换掉但句法不动等于没改。',
        '2. 不要堆砌"其实、后来、说实话"等语气词--过量反而更假。',
        '3. 不要破坏原意--核心事实、数据、人物称呼必须保留。',
        '4. 不要把短句变成同样整齐的长句--要保留长短错落的节奏。',
        '5. 不要所有句子变成同一个模式--这段里如果已有"说实话"开头,下一句就换种方式。',
        '',
        '必须保留原文事实、核心意思和称呼关系。',
        '输出只能是改写后的正文,不要解释,不要标题,不要 Markdown。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `使用场景:${scene}`,
        `优化强度:${intensityText}`,
        options.preserveMeaning === false ? '可以适度重组表达,但不要改事实。' : '必须保留原意。',
        options.preserveStructure === false ? '可以调整段落结构。' : '尽量保留原有段落层级。',
        referenceBlock,
        '请对下面文章做"去 AI 味"改写。',
        '要求:',
        '1. 不要只改标点或替换几个词。',
        '2. 每个有 AI 味的句子都要做实质性表达调整。',
        '3. 避免"不是……而是……""本质上""底层逻辑""长期主义"等模板表达。',
        '4. 改写后读起来要像一个真实的人写的。',
        '',
        '注意：请确保改写质量达到 S/A 级标准——读起来不像 AI、有真实阻力、有具体场景。',
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
 * 这里使用非流式请求,便于和现有小程序页面状态衔接。
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
        temperature: 0.78,
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
