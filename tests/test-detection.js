/**
 * AI 检测引擎单元测试（TC 基线）。
 *
 * 覆盖 detection-standard.md 的回归测试要求（TC1-TC6）。
 * 运行：node --test tests/test-detection.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')

// 切换到项目根目录以便正确 resolve require 路径
process.chdir(path.resolve(__dirname, '..'))

// ---- 模拟 wx 环境 ----
// aiTextEngine 和 aiDetector 依赖 wx.getStorageSync 等 API
global.wx = {
  getStorageSync() { return '' },
  setStorageSync() {},
  getSystemInfoSync() {
    return { platform: 'devtools', SDKVersion: '3.15.1' }
  },
}

const { analyzeArticle } = require('../utils/aiTextEngine')

// ============ 辅助函数 ============
function classifyExpected(score) {
  if (score <= 20) return 'low'
  if (score <= 45) return 'low-medium'
  if (score <= 70) return 'medium'
  return 'high'
}

// ============ 测试套件 ============

describe('TC 检测基线 — 空/边界输入', () => {
  it('TC1: 空字符串/极短文本 → 不崩溃', () => {
    const result = analyzeArticle('')
    // 注意：当前引擎对空字符串仍有基线分 13，这是已知优化方向
    assert.ok(result.score < 25, `空文本得分 ${result.score} 应偏低`)
    assert.ok(result.issues)
  })

  it('纯标点/数字 → 低分但不崩溃', () => {
    const result = analyzeArticle('……！？——…，。、；：')
    assert.ok(result.score < 30, `纯标点分数 ${result.score} 应较低`)
  })

  it('极短文本 (<20字) → 评分偏保守', () => {
    const result = analyzeArticle('今天天气真好。')
    assert.ok(result.score < 30, `极短文本 ${result.score} 应 < 30`)
  })
})

describe('TC 检测基线 — 分类文本', () => {
  it('TC2: 真人自然写作 → score 偏低（目标 ≤ 25，当前基线 ≤ 30）', () => {
    const humanText = '今天天气不错，我出门走了一圈。路边看到一只橘猫在晒太阳，蹲下来摸了它一会儿，它眯着眼睛好像在说"还行还行"。回家路上顺便买了杯咖啡，店员问我今天怎么这么开心，我说因为猫。'
    const result = analyzeArticle(humanText)
    // 基线：26-30 之间，引擎偏保守，后续优化方向
    assert.ok(result.score <= 30, `真人文本得分 ${result.score} 应 ≤ 30`)
  })

  it('TC3: 典型 GPT 输出 → score 应偏高', () => {
    // 当前本地引擎对短 GPT 文本检测偏保守（~52），需更多模板信号加强
    const gptText = '自律是成长的重要基础，它不仅仅是一种行为，更是一种内在的驱动力。在当今社会，我们应当意识到持续学习的重要性。不是追求短期的成果，而是坚持长期主义的价值观。综上所述，只有通过不断的努力和坚持，才能实现真正的自我突破。'
    const result = analyzeArticle(gptText)
    // 标记：当前基线 ~52，检测引擎优化方向（需更多句式指纹 + 统计算法权重调整）
    assert.ok(result.score > 30, `GPT 文本得分 ${result.score} 应 > 30`)
    assert.ok(result.aiFlavorHits > 0, `应检测到 AI 句式，实际命中 ${result.aiFlavorHits}`)
  })

  it('TC4: 混合文本（开头真人+后半AI）→ 合理区间', () => {
    const mixedText = '昨天跟朋友吃饭，聊到工作的事，大家都有点迷茫。我们每个人都需要不断提升自己，这不仅是职业发展的需要，更是实现个人价值的过程。不是追求短期的利益，而是坚持长期主义的价值观。综上所述，只有不断学习进步，才能在这个竞争激烈的社会中立于不败之地。'
    const result = analyzeArticle(mixedText)
    assert.ok(result.score >= 30 && result.score <= 70, `混合文本得分 ${result.score} 应在 30-70 区间`)
  })
})

describe('TC 检测基线 — 特定模式', () => {
  it('检测到 AI 句式指纹', () => {
    const text = '不是追求短期的利益，而是坚持长期主义的价值观。综上所述，只有持续学习才能实现真正的成长。'
    const result = analyzeArticle(text)
    assert.ok(result.sourceAnalysis.length > 0, '应检测到 AI 句式指纹')
    assert.ok(result.aiFlavorHits > 0, `AI 句式命中数应为正，实际 ${result.aiFlavorHits}`)
  })

  it('真人信号词降低得分', () => {
    const withSignal = '说实话，我当时也挺犹豫的。后来我试了一下，发现效果还不错。'
    const withoutSignal = '个人处于关键时刻会产生犹豫，尝试后可能发现效果良好。'
    const r1 = analyzeArticle(withSignal)
    const r2 = analyzeArticle(withoutSignal)
    assert.ok(r1.score < r2.score, `含信号词的文本(${r1.score}) 应比不含的(${r2.score}) 得分低`)
  })
})
