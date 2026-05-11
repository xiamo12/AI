// ============================================================
// AI 分析提示词构造器
//
// @version 1.1
// @updated 2025-05-11
// ============================================================

interface Message {
  role: 'system' | 'user'
  content: string
}

interface AnalysisOptions {
  detailLevel?: 'standard' | 'deep'
}

/** 构建云端分析 DeepSeek 请求消息 */
function buildAnalysisMessages(text: string, options: AnalysisOptions = {}): Message[] {
  const detail = options.detailLevel || 'standard'

  const detailedInstruction = detail === 'deep'
    ? '请逐句分析并返回每句的 problem_type 和 severity。'
    : '请返回整体分析结果。'

  return [
    {
      role: 'system',
      content: [
        '你是一个 AI 文本检测专家。请分析下面文本的 AI 生成痕迹。',
        '',
        '问题类型限定为：',
        '- template_expression（模板句式，如"不是…而是…""一方面…另一方面…"）',
        '- over_summary（过度总结口吻）',
        '- too_abstract（过于抽象，缺少具体细节）',
        '- too_regular（句式过于整齐均匀）',
        '- lack_detail（缺乏场景、动作、时间等具体落脚点）',
        '- weak_human_voice（缺少个人语气、人称）',
        '- emotion_flat（情绪平淡，缺少真实反应）',
        '- no_real_resistance（缺少现实阻力感，结果来得太容易）',
        '',
        `返回格式：JSON，包含 overallScore（0-100）、problemTypes[]、${detail === 'deep' ? 'sentences[]（每句分析）' : 'suggestions[]'}。`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        detailedInstruction,
        '',
        '文本：',
        text,
      ].join('\n'),
    },
  ]
}

/** 构建单句 AI 味分析提示词 */
function buildAnalysisPrompt(sentence: string): string {
  return [
    '请分析下面这个中文句子的 AI 生成痕迹。',
    '如果它读起来像人写的内容，就说"自然"。',
    '如果它读起来像 AI 写的，请指出具体和哪些 AI 习惯写法有关。',
    '',
    `句子：${sentence}`,
    '',
    '分析：',
  ].join('\n')
}

export {
  buildAnalysisMessages,
  buildAnalysisPrompt,
}
