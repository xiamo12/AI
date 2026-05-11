/**
 * 预留给未来云端模型的分析提示词。
 * 当前小程序使用本地启发式分析，但 prompt 单独保存，方便后续接入 API。
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
  buildAnalysisPrompt,
}
