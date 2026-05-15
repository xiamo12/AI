// aiSemanticConsistency.js — 段落级语义一致性检测 (v1.0)
// 检测三类异常：语义断层、观点矛盾、论据重复

const { normalizeText, splitSentences } = require('./util')

// 对立词对表
const OPPOSITE_PAIRS = [
  [/应该/, /不应该/], [/必须/, /不必/], [/需要/, /不需要/],
  [/支持/, /反对/], [/同意/, /反对/], [/肯定/, /否定/],
  [/好/, /坏/], [/优点/, /缺点/], [/有利/, /不利/],
  [/重要/, /不重要/], [/关键/, /无关紧要/],
  [/是重要的/, /不是/], [/有助于/, /不利于/],
  [/增长/, /下降/], [/提高/, /降低/], [/促进/, /抑制/],
  [/积极/, /消极/], [/乐观/, /悲观/],
]

// 典型论据关键词
const EVIDENCE_KEYWORDS = /(例如|比如|举例|研究[表显]|数据|统计|调查|实验|分析[发指]|报告|文献|研究[人者]|学者|专家)/g

// 提取段落中 2-4 字的关键内容 n-gram（无分词器时的近似方案）
function topicNGrams(text) {
  const cleaned = normalizeText(text).replace(/[\d a-zA-Z]/g, '')
  const functionChars = new Set('的了着过把被对于在在和与等跟从向沿着朝着按照凭靠根据关于由于为了除了比同跟和或及以及不但因为所以虽然但是如果然而而且因此这那什么怎么如何哪个哪些所有每个有的这些那些一切其中之其')
  const result = new Set()
  // 提取全部 2-4 字连续子串，过滤全虚词组
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= cleaned.length - len; i++) {
      const ngram = cleaned.slice(i, i + len)
      const fc = [...ngram].filter(c => functionChars.has(c))
      if (fc.length < len) result.add(ngram) // 至少包含 1 个非虚字
    }
  }
  return result
}

function jaccardSimilarity(a, b) {
  const setA = a, setB = b
  const intersection = [...setA].filter(x => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

/**
 * 检测段落间语义断层
 * 相邻段落关键名词交集过小 → 话题跳跃
 */
function detectSemanticGaps(paragraphs) {
  const results = []
  for (let i = 1; i < paragraphs.length; i++) {
    const prev = topicNGrams(paragraphs[i - 1])
    const curr = topicNGrams(paragraphs[i])
    if (prev.size < 15 || curr.size < 15) continue
    const sim = jaccardSimilarity(prev, curr)
    if (sim < 0.002) {
      results.push({
        type: 'semantic_gap',
        severity: 'medium',
        fromParagraph: i,
        toParagraph: i + 1,
        similarity: Number(sim.toFixed(3)),
        desc: `段落 ${i} 与段落 ${i+1} 之间语义断层（相似度 ${(sim * 100).toFixed(1)}%），缺少过渡衔接`,
      })
    }
  }
  return results
}

/**
 * 检测跨段观点矛盾
 * 一段说A好、一段说A不好
 */
function detectContradictions(paragraphs) {
  const results = []
  const paragraphSignals = paragraphs.map((p, idx) => {
    const signals = []
    OPPOSITE_PAIRS.forEach(([pos, neg]) => {
      const hasPos = pos.test(p)
      const hasNeg = neg.test(p)
      if (hasPos) signals.push({ idx, dir: 'pos', pair: pos.source + '|' + neg.source })
      if (hasNeg) signals.push({ idx, dir: 'neg', pair: pos.source + '|' + neg.source })
    })
    return signals
  })

  for (let i = 0; i < paragraphSignals.length; i++) {
    for (const sig of paragraphSignals[i]) {
      for (let j = i + 1; j < paragraphSignals.length; j++) {
        if (results.length >= 5) return results // 上限5条避免 O(n⁴) 卡顿
        for (const sig2 of paragraphSignals[j]) {
          if (sig.pair === sig2.pair && sig.dir !== sig2.dir) {
            results.push({
              type: 'contradiction',
              severity: 'high',
              fromParagraph: i + 1,
              toParagraph: j + 1,
              desc: `段落 ${i+1} 与段落 ${j+1} 存在观点矛盾（${sig.pair}）`,
            })
          }
        }
      }
    }
  }
  return results
}

/**
 * 检测跨段论据重复
 * 多个段落使用相同类型的论据（如"研究显示"）
 */
function detectRedundantEvidence(paragraphs) {
  const results = []
  const paragraphEvidence = paragraphs.map((p) => {
    const matches = p.match(EVIDENCE_KEYWORDS) || []
    return [...new Set(matches)]
  })

  for (let i = 0; i < paragraphEvidence.length; i++) {
    for (let j = i + 1; j < paragraphEvidence.length; j++) {
      const overlaps = paragraphEvidence[i].filter(kw => paragraphEvidence[j].includes(kw))
      if (overlaps.length >= 2) {
        results.push({
          type: 'redundant_evidence',
          severity: 'medium',
          fromParagraph: i + 1,
          toParagraph: j + 1,
          desc: `段落 ${i+1} 与段落 ${j+1} 使用了相同的论据模式（${overlaps.join('、')}）`,
          keywords: overlaps,
        })
      }
    }
  }
  return results
}

/**
 * 主入口：分析全文语义一致性
 * @param {string} text - 归一化后的全文
 * @returns {{ issues: Array, score: number }}
 */
function analyzeConsistency(text) {
  const paragraphs = normalizeText(text).split(/\n+/).filter(Boolean)
  if (paragraphs.length < 2) {
    return { issues: [], score: 0 }
  }

  const gaps = detectSemanticGaps(paragraphs)
  const contradictions = detectContradictions(paragraphs)
  const redundancies = detectRedundantEvidence(paragraphs)

  const allIssues = [...gaps, ...contradictions, ...redundancies]
  const severityMap = { high: 3, medium: 1 }
  const rawScore = allIssues.reduce((sum, issue) => sum + (severityMap[issue.severity] || 0), 0)
  const maxPossible = paragraphs.length * 3
  const score = Math.min(100, Math.round((rawScore / Math.max(maxPossible, 1)) * 100))

  return {
    issues: allIssues,
    score,
    gapCount: gaps.length,
    contradictionCount: contradictions.length,
    redundancyCount: redundancies.length,
    paragraphCount: paragraphs.length,
  }
}

module.exports = { analyzeConsistency }
