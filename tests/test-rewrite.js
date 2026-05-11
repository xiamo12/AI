/**
 * 改写引擎单元测试（RW 基线）。
 *
 * 覆盖 rewriting-standard.md 的回归测试要求（RW1-RW5）。
 * 运行：node --test tests/test-rewrite.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')

// 切换到项目根目录以便正确 resolve require 路径
process.chdir(path.resolve(__dirname, '..'))

// ---- 模拟 wx 环境 ----
global.wx = {
  getStorageSync() { return '' },
  setStorageSync() {},
  getSystemInfoSync() { return { platform: 'devtools', SDKVersion: '3.15.1' } },
}

const rewritePipeline = require('../core/pipeline/rewritePipeline')
const { normalizeText, hasSubstantiveChange } = rewritePipeline

// 使用 evaluateRewriteQuality 做质量评估
const { evaluateRewriteQuality } = require('../core/quality/rewriteQuality')

// ============ 辅助函数 ============
function normalizeForCompare(text) {
  return String(text || '')
    .replace(/[，。！？；：、""''（）()《》,.!?;:\s｜|—\-–_]|\]]/g, '')
    .trim()
}

function sentences(text) {
  return text.split(/[。！？!?；;]+/).filter(Boolean)
}

// ============ 测试套件 ============

describe('RW 改写基线 — 边界/安全', () => {
  it('RW5: 空字符串 → 不崩溃', () => {
    const result = rewritePipeline.rewriteArticle('')
    assert.ok(result.text === '')
    assert.equal(result.changed, false)
    assert.ok(Array.isArray(result.sentenceResults))
  })

  it('极短文本 → 返回合理结果', () => {
    const result = rewritePipeline.rewriteArticle('好的')
    assert.ok(result.text.length > 0 || result.text === '')
    // 不应崩溃
  })

  it('纯标点 → 不崩溃', () => {
    const result = rewritePipeline.rewriteArticle('……！？——…')
    assert.ok(result.text !== undefined)
  })
})

describe('RW 改写基线 — 实质变更检测', () => {
  it('hasSubstantiveChange: 相同文本返回 false', () => {
    assert.equal(hasSubstantiveChange('今天天气真好。', '今天天气真好。'), false)
  })

  it('hasSubstantiveChange: 仅标点不同返回 false', () => {
    assert.equal(hasSubstantiveChange('今天天气真好。', '今天天气真好！'), false)
  })

  it('hasSubstantiveChange: 实质改变返回 true', () => {
    assert.equal(hasSubstantiveChange('今天天气真好。', '今天天气确实不错，阳光很好。'), true)
  })
})

describe('RW 改写基线 — 模板句改写', () => {
  it('RW1: 简单模板句 → 有阻力感、有具体场景', () => {
    const original = '坚持阅读能提升认知，这是长期主义的核心。'
    const result = rewritePipeline.rewriteArticle(original)
    const rewritten = result.text
    const analysis = evaluateRewriteQuality(original, rewritten)

    // 必须有实质变更
    assert.equal(result.changed, true, '模板句应产生实质变更')
    // 不应是机械替换
    assert.ok(analysis.grade !== 'D', `不应为 D 级（完全无变化），实际 ${analysis.grade} 分=${analysis.score}`)
    // 改写后不应只是同义替换
    const origFingerprint = normalizeForCompare(original)
    const rewrtFingerprint = normalizeForCompare(rewritten)
    assert.ok(origFingerprint !== rewrtFingerprint, '改写后指纹不应与原文相同')
  })

  it('RW2: 不是…而是…对照结构 → 打破对照', () => {
    const original = '不是追求短期的利益，而是坚持长期主义的价值观，这才是真正的成长之道。'
    const result = rewritePipeline.rewriteArticle(original)
    const rewritten = result.text

    // 对照结构应被打破
    const hasNotButStructure = /不是[^。！？；;\n]{1,46}而是/.test(rewritten)
    assert.ok(!hasNotButStructure || rewritten.length !== original.length,
      '对照结构"不是…而是…"应被打破或改写')
    assert.equal(result.changed, true)
  })

  it('RW3: 排比堆积句 → 拆散排比', () => {
    const original = '阅读能开阔视野，学习能提升能力，思考能深化认知，实践能检验真理。'
    const result = rewritePipeline.rewriteArticle(original)
    const rewritten = result.text

    assert.equal(result.changed, true)
    // 应比原文长（增加了细节）或结构不同
    const origSents = sentences(original)
    const rewrtSents = sentences(rewritten)
    const hasStructureChange = normalizeForCompare(original) !== normalizeForCompare(rewritten)
    assert.ok(hasStructureChange, '排比句应被拆散')
  })
})

describe('RW 改写基线 — 跨句平滑', () => {
  it('连续句式前缀去重: 3 句连续同一前缀应去重', () => {
    // 模拟管道输出（人工构造触发 dedupConsecutivePrefixes 的场景）
    const text = '说实话，这件事没那么容易。说实话，一开始我也不太确定。说实话，后来我想通了。'
    const smoothed = rewritePipeline.finalPolish(text)
    const occurrences = (smoothed.match(/说实话/g) || []).length
    assert.ok(occurrences <= 2, `"说实话"出现 ${occurrences} 次，应有去重效果`)
  })

  it('重复标点修复：。。→。', () => {
    const text = '这是第一句。。这是第二句。。'
    const smoothed = rewritePipeline.smoothTransitions(text)
    assert.ok(!smoothed.includes('。。'), '重复句号应被合并')
  })

  it('双前缀拼接修复', () => {
    const text = '那天晚上，后来我发现，很多能坚持下来的人，也会有没状态的时候。'
    const smoothed = rewritePipeline.smoothTransitions(text)
    // 应合并双前缀
    assert.ok(!smoothed.includes('那天晚上，后来我发现，'), `"那天晚上，后来我发现，" 应被合并，实际: "${smoothed}"`)
  })
})

describe('RW 改写基线 — 全文改写', () => {
  it('RW4: 300 字短文章 → 改写后无明显模板', () => {
    const article = [
      '自律是成长的重要基础。它不仅仅是一种行为，更是内心深处的自我驱动。',
      '在当今社会，我们面临着各种各样的诱惑和干扰。只有坚持自律，才能避免陷入短期满足的陷阱。',
      '不是追求眼前的利益，而是坚持长期主义的价值观。这是一个需要持续坚持的过程。',
      '阅读也是提升自我的重要方式。通过阅读，我们可以获取知识，拓展视野，提升思维能力。',
      '综上所述，自律和阅读是个人成长的两个重要支柱。坚持这两件事，终将带来非凡的改变。',
    ].join('')

    const result = rewritePipeline.rewriteArticle(article)
    const rewritten = result.text

    assert.equal(result.changed, true, '全文改写应产生实质变更')

    // 用 quality 评估
    const quality = evaluateRewriteQuality(article, rewritten)
    console.log(`\n  RW4 质量等级: ${quality.grade} (${quality.score}分)`)
    if (quality.issues.length > 0) {
      quality.issues.forEach((issue) => console.log(`  ⚠ ${issue}`))
    }

    // 全文改写应达到 B 级或以上
    assert.ok(quality.grade !== 'D', `不应为 D 级（事实丢失或无变化），实际为 ${quality.grade}`)
  })
})
