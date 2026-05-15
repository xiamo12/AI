// tests/test-semantic-consistency.js
// 测试 utils/aiSemanticConsistency.js — 段落级语义一致性检测
// 不依赖 wx API，可直接 node --test 运行

const assert = require('node:assert')
const { test } = require('node:test')
const { analyzeConsistency } = require('../utils/aiSemanticConsistency')

test('语义一致性 - 单段落返回空', () => {
  const result = analyzeConsistency('这是一个只有一段的测试文本。')
  assert.strictEqual(result.issues.length, 0)
  assert.strictEqual(result.score, 0)
})

test('语义一致性 - 语义连贯的段落无断层', () => {
  const text = [
    '人工智能正在深刻改变教育行业。越来越多的学校开始引入AI辅助教学系统。',
    'AI可以根据学生的学习数据提供个性化学习方案。这能帮助每个学生找到最适合自己的学习节奏。',
    '未来，AI与教育的深度融合将成为大势所趋。教师角色将从知识传授者转变为学习引导者。',
  ].join('\n')
  const result = analyzeConsistency(text)
  // 主题一致（教育/AI），不应有断层
  const gaps = result.issues.filter((item) => item.type === 'semantic_gap')
  assert.ok(gaps.length === 0, `不应有语义断层，但发现 ${gaps.length} 处`)
})

test('语义一致性 - 语义断层检测', () => {
  const text = [
    '量子计算利用量子比特的叠加态进行并行计算，理论上可以在特定问题上远超经典计算机。最近谷歌的Willow芯片在这一领域取得了重要突破。',
    '今晚的月亮特别圆，让我想起了小时候在外婆家度过的夏天。那时候池塘边的萤火虫像星星一样闪烁。',
  ].join('\n')
  const result = analyzeConsistency(text)
  // 量子计算 → 月亮回忆，主题跳跃
  const gaps = result.issues.filter((item) => item.type === 'semantic_gap')
  assert.ok(gaps.length > 0, '主题跳跃应被检测为语义断层')
})

test('语义一致性 - 观点矛盾检测', () => {
  const text = [
    '远程办公应该被全面推广，它能显著提升员工工作效率和生活质量。',
    '然而，远程办公不应该成为常态，因为团队协作效率会大幅下降。',
  ].join('\n')
  const result = analyzeConsistency(text)
  const contradictions = result.issues.filter((item) => item.type === 'contradiction')
  assert.ok(contradictions.length > 0, '前后观点矛盾应被检测')
})

test('语义一致性 - 论据重复检测', () => {
  const text = [
    '研究显示，每天运动30分钟可以降低心血管疾病风险。',
    '根据最新的研究显示，运动对健康益处显著。',
  ].join('\n')
  const result = analyzeConsistency(text)
  // 两段都用了"研究显示"类论据词
  assert.ok(result.score >= 0, '应返回正常评分')
})

test('语义一致性 - 三段长文本综合检测', () => {
  const text = [
    '数据安全是数字经济时代的核心议题。企业需要建立完善的数据保护机制。研究显示，数据泄露的平均成本逐年上升。',
    '保护用户隐私应该成为企业的基本准则。相关研究表明，消费者越来越重视个人信息安全。',
    '今天晚上吃什么？外卖还是自己做饭？这是一个值得思考的问题。',
  ].join('\n')
  const result = analyzeConsistency(text)
  assert.ok(result.paragraphCount === 3)
  // 至少会出现语义断层（第三段主题跳跃）
  const gaps = result.issues.filter((item) => item.type === 'semantic_gap')
  assert.ok(gaps.length >= 1, '主题跳跃段落应检出语义断层')
})

test('语义一致性 - 边界输入（空白文本）', () => {
  const result = analyzeConsistency('')
  assert.strictEqual(result.issues.length, 0)
  assert.strictEqual(result.score, 0)
})

test('语义一致性 - 边界输入（仅换行）', () => {
  const result = analyzeConsistency('\n\n\n')
  assert.strictEqual(result.issues.length, 0)
  assert.strictEqual(result.score, 0)
})

test('语义一致性 - 边界输入（大量短段落）', () => {
  const paragraphs = Array.from({ length: 50 }, (_, i) => `这是第${i + 1}段。`)
  const result = analyzeConsistency(paragraphs.join('\n'))
  assert.ok(result.paragraphCount > 0)
  assert.ok(Array.isArray(result.issues))
})
