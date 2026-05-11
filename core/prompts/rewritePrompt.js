/**
 * 预留给未来云端模型的改写提示词。
 * 当前 rewritePipeline 通过 skill 系统执行同样的策略。
 */
function buildRewritePrompt(sentence, analysis, skills) {
  return [
    '请不要做同义词替换，而要改变表达路径。',
    `原句：${sentence}`,
    `问题：${analysis && analysis.problem_type}`,
    `方向：${analysis && analysis.rewrite_direction}`,
    `可用技能：${(skills || []).join('、')}`,
    '要求：保留原意，但改成更像真人写下来的自然表达。',
  ].join('\n')
}

module.exports = {
  buildRewritePrompt,
}
