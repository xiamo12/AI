/**
 * 预留给未来云端模型的全文润色提示词。
 * 当前 Final Polish Layer 在本地完成节奏、语气和拼接感修正。
 */
function buildPolishPrompt(article) {
  return [
    '请对逐句改写后的文章做最后润色。',
    '目标：节奏统一、情绪统一、语气统一、上下文衔接自然、删除拼接感。',
    '不要改变核心事实，不要增加夸张结论。',
    `文章：${article}`,
  ].join('\n')
}

module.exports = {
  buildPolishPrompt,
}
