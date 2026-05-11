/**
 * AI 分析提示词构造器。
 *
 * 提供 DeepSeek 分析 AI 味所需的 prompt 构造。
 * 当前小程序以本地启发式分析为主，此模块供需要云端分析时使用。
 */

/**
 * 构建云端分析 DeepSeek 请求消息。
 * @param {string} text - 待分析文本（全文或段落）
 * @param {object} [options]
 * @returns {Array<{role, content}>}
 */
function buildAnalysisMessages(text, options = {}) {
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

/**
 * 构建单句 AI 味分析提示词。
 * @param {string} sentence
 * @returns {string}
 */
function buildAnalysisPrompt(sentence) {
  return [
    '请分析下面句子的 AI 味来源。',
    '只返回 problem_type、severity、rewrite_direction。',
    '问题类型限定为 template_expression、over_summary、too_abstract、too_regular、lack_detail、weak_human_voice、emotion_flat、no_real_resistance。',
    `句子：${sentence}`,
  ].join('\n')
}

module.exports = {
  buildAnalysisMessages,
  buildAnalysisPrompt,
}
