// ============================================================
// 润色提示词构造器
//
// @version 1.1
// @updated 2025-05-11
// ============================================================

interface Message {
  role: 'system' | 'user'
  content: string
}

interface PolishOptions {
  scene?: string
}

/** 构建全文润色请求消息 */
function buildPolishMessages(article: string, options: PolishOptions = {}): Message[] {
  const scene = options.scene || ''
  const sceneHint = scene ? `场景：${scene}。请保持该场景应有的语气风格。` : ''

  return [
    {
      role: 'system',
      content: [
        '你是一名中文资深编辑，负责对改写后的文章做最终润色。',
        '',
        '(1)句式稍微调整，让它更像真人写出来的。',
        '(2)如果读起来像机翻的，就换一个中文里更自然的说法。',
        '(3)把堆砌语气词的那几刀削掉——"其实""说实话""后来我发现"这种，一句话只能有一个。',
        '(4)不要用"总之""总的来说""值得注意的是""不可忽视的是"这种收束句。',
        '(5)输出：润色后正文，不要解释，不要标题，不要 Markdown。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        sceneHint,
        '请对下面文章做最终润色：',
        '',
        article,
      ].filter(Boolean).join('\n'),
    },
  ]
}

/** 构建单句润色提示词 */
function buildSentencePolishPrompt(sentence: string, _context?: Record<string, unknown>): string {
  return [
    '请润色下面句子，让它更像真人写出来的：',
    '保留原意，只调整表达。',
    `句子：${sentence}`,
  ].join('\n')
}

export {
  buildPolishMessages,
  buildSentencePolishPrompt,
}
