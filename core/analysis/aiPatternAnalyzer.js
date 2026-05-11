const ABSTRACT_WORDS = [
  '长期主义', '底层逻辑', '本质上', '破局', '闭环', '松弛感', '情绪价值',
  '认知升级', '自我成长', '价值感', '内耗', '复利', '底层能力', '向上生长',
]

const TEMPLATE_PATTERNS = [
  /不是[^。！？；;\n]{1,46}而是/,
  /不是[^。！？；;\n]{1,46}只是/,
  /真正[^。！？；;\n]{0,18}的人/,
  /你要明白/,
  /说到底/,
  /归根结底/,
  /本质上/,
  /在这个[^。！？；;\n]{0,12}时代/,
  /越[^。！？；;\n]{1,18}越/,
  /从[^。！？；;\n]{1,28}到[^。！？；;\n]{1,28}再到/,
]

const SUMMARY_PATTERNS = [
  /综上所述/, /总而言之/, /不难看出/, /由此可见/, /可以说/, /这意味着/,
  /具有重要意义/, /提供了新的思路/, /进一步推动/, /值得注意的是/,
]

const DETAIL_PATTERNS = [
  /\d+/, /今天|昨晚|早上|周末|那天|最近|刚才/, /手机|地铁|电脑|桌子|微信|评论区|会议室|办公室/,
  /看见|听见|翻到|坐着|站着|盯着|走到|发出去|收到/, /“[^”]+”|《[^》]+》/,
]

const HUMAN_VOICE_PATTERNS = [
  /我|我们|你|朋友|同事|家里人/, /说实话|坦白讲|后来|当时|有时候|其实|我以前/,
]

const EMOTION_PATTERNS = [
  /焦虑|烦|犹豫|松一口气|发慌|尴尬|委屈|开心|难受|突然意识到|没想明白|有点/,
]

const RESISTANCE_PATTERNS = [
  /但|可是|不过|问题是|偏偏|卡住|没那么容易|做不到|顾不上|来不及|不好意思|担心|害怕/,
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function countHits(sentence, patterns) {
  return patterns.reduce((total, pattern) => total + (pattern.test(sentence) ? 1 : 0), 0)
}

function hasAbstractWords(sentence) {
  return ABSTRACT_WORDS.some((word) => sentence.indexOf(word) >= 0)
}

function getClauseLengths(sentence) {
  return sentence
    .split(/[，,；;、]/)
    .map((item) => item.trim().length)
    .filter(Boolean)
}

function getRhythmRegularity(sentence) {
  const lengths = getClauseLengths(sentence)
  if (lengths.length < 3) return 0
  const avg = lengths.reduce((sum, len) => sum + len, 0) / lengths.length
  const diff = lengths.reduce((sum, len) => sum + Math.abs(len - avg), 0) / lengths.length
  return diff <= 3 ? 1 : 0
}

function getPrimaryProblem(scores) {
  return Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0]
}

function getRewriteDirection(problemType) {
  const directions = {
    template_expression: '把套话改成个人观察，避开概念化判断。',
    over_summary: '减少总结口吻，改成具体场景里的发现。',
    too_abstract: '把抽象概念落到动作、时间和真实处境里。',
    too_regular: '打散过整齐的句式，让长短句混合。',
    lack_detail: '补入时间、场景、动作或感受，让句子有落点。',
    weak_human_voice: '增加适度的第一人称或真实停顿。',
    emotion_flat: '补入细微情绪，让表达不只是在下结论。',
    no_real_resistance: '加入现实阻力和转折，让表达更像经历过的事。',
  }
  return directions[problemType] || '保留原意，调整为更自然的人类表达。'
}

/**
 * 分析单句的 AI 味来源。
 *
 * 这个分析器只负责判断“这句话为什么像机器写的”，不直接改写文本。
 * 它输出稳定的数据结构，供后续 Strategy Mapper 选择不同 skill。
 */
function analyzeSentence(sentence, context = {}) {
  const text = String(sentence || '').trim()
  if (!text) {
    return {
      sentence: '',
      problem_type: 'weak_human_voice',
      severity: 0,
      rewrite_direction: '空句子无需改写。',
    }
  }

  const templateHits = countHits(text, TEMPLATE_PATTERNS)
  const summaryHits = countHits(text, SUMMARY_PATTERNS)
  const detailHits = countHits(text, DETAIL_PATTERNS)
  const humanHits = countHits(text, HUMAN_VOICE_PATTERNS)
  const emotionHits = countHits(text, EMOTION_PATTERNS)
  const resistanceHits = countHits(text, RESISTANCE_PATTERNS)
  const regularity = getRhythmRegularity(text)
  const isLong = text.length > 42
  const isVeryShort = text.length <= 8
  const abstractScore = hasAbstractWords(text) ? 34 : 0

  const scores = {
    template_expression: templateHits * 30 + (abstractScore && templateHits ? 14 : 0),
    over_summary: summaryHits * 28 + (/因此|所以|总之|最后/.test(text) && text.length > 18 ? 12 : 0),
    too_abstract: abstractScore + (detailHits === 0 && text.length > 18 ? 16 : 0),
    too_regular: regularity * 34 + (isLong && /，/.test(text) ? 10 : 0),
    lack_detail: detailHits === 0 && text.length > 16 ? 32 : 0,
    weak_human_voice: humanHits === 0 && detailHits === 0 && text.length > 14 ? 22 : 0,
    emotion_flat: emotionHits === 0 && /我|你|我们|关系|成长|自律|焦虑|选择/.test(text) ? 24 : 0,
    no_real_resistance: resistanceHits === 0 && /坚持|成长|优秀|改变|提升|成功|努力|选择/.test(text) ? 22 : 0,
  }

  let problemType = getPrimaryProblem(scores)
  let severity = scores[problemType] || 0

  if (isVeryShort && !templateHits) {
    problemType = 'weak_human_voice'
    severity = Math.min(severity, 8)
  }

  const pass = Number(context.pass || 1)
  severity = clamp(severity + Math.max(0, pass - 1) * 4, 0, 100)

  return {
    sentence: text,
    problem_type: problemType,
    severity,
    rewrite_direction: getRewriteDirection(problemType),
  }
}

/**
 * 批量分析句子，保留原始顺序，方便结果页做风险排序和定位。
 */
function analyzeArticleSentences(sentences, context = {}) {
  return (sentences || []).map((sentence, index) => ({
    ...analyzeSentence(sentence, { ...context, sentenceIndex: index }),
    index,
  }))
}

module.exports = {
  analyzeSentence,
  analyzeArticleSentences,
  getRewriteDirection,
}
