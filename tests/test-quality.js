/**
 * 改写质量评估单元测试。
 *
 * 覆盖 evaluateRewriteQuality 的 S/A/B/C/D 分级逻辑。
 * 运行：node --test tests/test-quality.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')

// 切换到项目根目录以便正确 resolve require 路径
process.chdir(path.resolve(__dirname, '..'))

const {
  evaluateRewriteQuality,
  checkMechanicalReplace,
  checkFillerOveruse,
  checkNewTemplates,
  checkFactPreservation,
} = require('../core/quality/rewriteQuality')

// ============ 辅助函数 ============
function hasIssue(issues, keyword) {
  return issues.some((i) => i.includes(keyword))
}

// ============ 测试套件 ============

describe('checkMechanicalReplace', () => {
  it('检测极微修改（只换量词）', () => {
    const orig = '这是一个非常明确的目标和清晰的方向'
    const rewr = '这是一项非常明确的目标和清晰的方向'
    // 仅改 1 个汉字，句法结构完全一致
    assert.equal(checkMechanicalReplace(orig, rewr), true)
  })

  it('句长明显变化不算机械替换', () => {
    const orig = '阅读能提升认知。'
    const rewr = '说实话，以前我不太爱看书，后来慢慢翻多了才发现，阅读确实能带来不一样的东西。'
    assert.equal(checkMechanicalReplace(orig, rewr), false)
  })

  it('文本变化大不算机械替换', () => {
    const orig = '坚持阅读能提升认知，这是长期主义的核心。'
    const rewr = '有时候翻了几页就犯困，但第二天还是拿起来翻一翻。'
    assert.equal(checkMechanicalReplace(orig, rewr), false)
  })
})

describe('checkFillerOveruse', () => {
  it('语气词过多时检测', () => {
    const text = '说实话，这件事没那么简单。其实，我也没想明白。后来我发现，原来是这样。说实话，这让我很意外。'
    const result = checkFillerOveruse(text)
    assert.equal(result.overused, true)
    assert.ok(result.totalFillers >= 4)
  })

  it('正常文本不误报', () => {
    const text = '今天天气不错，出门走了一圈。路边的花开了，感觉心情好多了。'
    const result = checkFillerOveruse(text)
    assert.equal(result.overused, false)
  })
})

describe('checkNewTemplates', () => {
  it('检测常见的 AI 模板句式', () => {
    const text = '综上所述，这不只是一个简单的选择，更是一个长期的承诺。值得注意的是，底层逻辑决定了最终走向。'
    const hits = checkNewTemplates(text)
    assert.ok(hits.length >= 2)
  })

  it('自然文本不触发', () => {
    const text = '我一直觉得写作这件事，写多了就顺了，没什么特别的秘诀。'
    const hits = checkNewTemplates(text)
    assert.equal(hits.length, 0)
  })
})

describe('checkFactPreservation', () => {
  it('数字保留检测', () => {
    const orig = '2024年有85%的用户选择了这个方案。'
    const rewr = '去年大多数用户选择了这个方案。'
    const result = checkFactPreservation(orig, rewr)
    assert.equal(result.preserved, false)
    assert.ok(result.missing.some((m) => m.includes('丢失')), `应有缺失事实提示，实际为 ${result.missing.join(', ')}`)
  })

  it('数字保留通过', () => {
    const orig = '2024年有85%的用户选择了这个方案。'
    const rewr = '2024年，85%的用户选择了这个方案。'
    const result = checkFactPreservation(orig, rewr)
    assert.equal(result.preserved, true)
  })
})

describe('evaluateRewriteQuality — 全面评估', () => {
  it('原文改写无变化 → D 级', () => {
    const orig = '坚持阅读能提升认知，这是长期主义的核心。'
    const rewr = '坚持阅读能提升认知，这是长期主义的核心。'
    const result = evaluateRewriteQuality(orig, rewr)
    // 无变化 → 至少降至 C 级或以下
    assert.ok(result.grade !== 'S' && result.grade !== 'A', `无变化文本不应高分，实际 ${result.grade} 分=${result.score}`)
    assert.ok(hasIssue(result.issues, '没有实质变更'))
  })

  it('机械替换 → C 或 D 级', () => {
    const orig = '坚持阅读能提升认知，这是长期主义的核心。'
    const rewr = '坚持读书能提高认知，这是长期坚持的核心。'
    const result = evaluateRewriteQuality(orig, rewr)
    assert.ok(result.grade !== 'S', `机械替换文本不应为 S 级，实际 ${result.grade} 分=${result.score}`)
    assert.ok(hasIssue(result.issues, '机械替换'))
  })

  it('优质改写 → A 或 S 级', () => {
    const orig = '自律能够帮助人们更好地实现个人目标。坚持阅读能够提升认知能力。'
    const rewr = '说实话，自律这件事没那么容易。有时候闹钟响了就是不想起，但还是得爬起来。阅读也一样，翻几页就犯困，不过第二天还是会拿起来翻一翻。'
    const result = evaluateRewriteQuality(orig, rewr)
    assert.ok(result.grade === 'A' || result.grade === 'S', `期望 A/S 级，实际为 ${result.grade} 分=${result.score}`)
  })

  it('改写结果为空 → D 级', () => {
    const result = evaluateRewriteQuality('这是原文', '')
    assert.equal(result.grade, 'D')
    assert.equal(result.score, 0)
  })

  it('语气词堆砌会被扣分', () => {
    const orig = '自律是成长的基础。'
    const rewr = '说实话，其实，后来我发现，说实话自律这件事确实很重要。说实话，我就是这么觉得的。'
    const result = evaluateRewriteQuality(orig, rewr)
    assert.ok(result.score < 90, `分数 ${result.score} 应低于 90`)
    assert.ok(hasIssue(result.issues, '语气词'))
  })

  it('改写后仍有模板句式会扣分', () => {
    const orig = '这个过程很重要。'
    const rewr = '综上所述，这个过程非常重要。值得注意的是，底层逻辑决定了它的走向。'
    const result = evaluateRewriteQuality(orig, rewr)
    assert.ok(result.score <= 85, `分数 ${result.score} 应 ≤ 85`)
    assert.ok(hasIssue(result.issues, '模板句式') || hasIssue(result.issues, '模板'))
  })

  it('事实丢失直接降到 D 级', () => {
    const orig = '2024年有85%的测试者通过了验证。'
    const rewr = '去年大部分人都通过了测试。'
    const result = evaluateRewriteQuality(orig, rewr)
    assert.equal(result.grade, 'D')
    assert.ok(hasIssue(result.issues, '事实丢失'))
  })
})
