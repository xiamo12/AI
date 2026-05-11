/**
 * B 轮测试：管道层跨句平滑
 */
const { rewriteArticle, smoothTransitions } = require('../rewritePipeline')

function test(name, input, checkFn) {
  const result = rewriteArticle(input, { forceChange: true })
  console.log(`\n=== ${name} ===`)
  console.log('原文:', input)
  console.log('改写:', result.text)
  console.log('变更:', result.changed ? '✅' : '❌')
  checkFn(result)
}

// 基础回归测试
test('RW2: 典型 GPT 对照结构', '长期主义不是坚持做一件事，而是在每一次遇到困难时还能继续往前推进的能力。', (r) => {
  if (!r.changed) console.warn('  ⚠️ RW2 未发生实质变更')
})

test('RW4: 300 字短文章', '在当今社会，长期主义是一个非常重要的概念。它不仅仅是坚持做一件事，更重要的是在面对困难时能够保持前行的动力。从个人成长到职业发展，从学习知识到培养技能，长期主义都有着重要的意义。总的来说，坚持长期主义能够帮助我们获得更好的结果。不是每个人都能做到长期坚持，而是那些真正理解长期价值的人才能做到。值得注意的是，长期主义也需要灵活调整策略，而不是盲目坚持。', (r) => {
  if (!r.changed) console.warn('  ⚠️ RW4 未发生实质变更')
})

test('RW5: 空字符串', '', (r) => {
  if (r.changed) console.warn('  ⚠️ RW5 空字符串不应有变更')
})

// B-1: 连续句式前缀去重
test('B-1: 连续句式前缀去重', '说实话，这件事没那么容易。说实话，一开始我也不太确定。说实话，后来我想通了。', (r) => {
  const count = (r.text.match(/说实话/g) || []).length
  if (count >= 3) {
    console.warn(`  ⚠️ B-1 仍有 ${count} 次"说实话"——前缀去重未生效`)
  } else {
    console.log(`  ✅ 连续前缀已去重（"说实话"出现 ${count} 次）`)
  }
})

// B-2: 双前缀拼接 — 用 smoothTransitions 直接测试
console.log('\n=== B-2: smoothTransitions 双前缀直接测试 ===')
const b2Input = '那天晚上，后来我发现，很多能坚持下来的人，也会有没状态的时候。'
const b2Output = smoothTransitions(b2Input)
console.log('输入:', b2Input)
console.log('输出:', b2Output)
if (b2Output.includes('后来我发现，')) {
  console.warn('  ⚠️ B-2 仍然包含第二个前缀')
} else {
  console.log('  ✅ 双前缀已合并')
}

// B-3: dedupIdenticalPatterns 填坑词去重（不同内容不应误判）
console.log('\n=== B-3: 句模雷同不误判（经 rewriteArticle）===')
const b3Input = '后来我发现，真正动手去做的时候，这件事就变得具体了。后来我发现，那天晚上，总的来说，坚持很重要。'
const b3Result = rewriteArticle(b3Input, { forceChange: true })
console.log('输入:', b3Input)
console.log('输出:', b3Result.text)
if (b3Result.text.startsWith('现，') || b3Result.text.includes('现，那天晚上')) {
  console.warn('  ⚠️ B-3 误判雷同，错误截断了句子')
} else {
  console.log('  ✅ 未误判，两句话都保留了完整内容')
}

console.log('\n=== 全部测试完成 ===')
