const articleTypes = ['通用文章', '学生作文', '营销文案', '新闻稿', '技术文档']

const templatePhrases = [
  '综上所述',
  '总而言之',
  '不难看出',
  '值得注意的是',
  '在当今社会',
  '随着时代的发展',
  '具有重要意义',
  '提供了新的思路',
  '进一步推动',
  '不可忽视',
  '本文将从',
  '以下几个方面',
  '无论是',
  '不仅如此',
  '与此同时',
  '因此',
  '然而',
  '此外',
]

const aiFlavorPatterns = [
  { label: '不是...而是...', regex: /不是[^。！？；;\n]{1,42}而是/g },
  { label: '不是...只是...', regex: /不是[^。！？；;\n]{1,42}只是/g },
  { label: '不是因为...只是...', regex: /不是因为[^。！？；;\n]{1,42}只是/g },
  { label: '不是因为...而是因为...', regex: /不是因为[^。！？；;\n]{1,42}而是因为/g },
  { label: '并不是...而是...', regex: /并不是[^。！？；;\n]{1,42}而是/g },
  { label: '与其...不如...', regex: /与其[^。！？；;\n]{1,42}不如/g },
  { label: '你以为...其实...', regex: /你以为[^。！？；;\n]{1,42}其实/g },
  { label: '真正的...不是...而是...', regex: /真正的[^。！？；;\n]{1,28}不是[^。！？；;\n]{1,42}而是/g },
  { label: '所谓...不是...而是...', regex: /所谓[^。！？；;\n]{1,28}不是[^。！？；;\n]{1,42}而是/g },
  { label: '从来不是...而是...', regex: /从来不是[^。！？；;\n]{1,42}而是/g },
  { label: '不是要...而是要...', regex: /不是要[^。！？；;\n]{1,42}而是要/g },
  { label: '不是所有...都...', regex: /不是所有[^。！？；;\n]{1,28}都/g },
  { label: '不取决于...而取决于...', regex: /不取决于[^。！？；;\n]{1,42}而取决于/g },
  { label: '一方面...另一方面...', regex: /一方面[^。！？；;\n]{1,50}另一方面/g },
  { label: '首先...其次...最后...', regex: /首先[^。！？\n]{1,80}其次[^。！？\n]{1,80}(最后|总之|因此)/g },
  { label: '从...到...再到...', regex: /从[^。！？；;\n]{1,24}到[^。！？；;\n]{1,24}再到/g },
  { label: '既是...也是...', regex: /既是[^。！？；;\n]{1,42}也是/g },
  { label: '既要...也要...', regex: /既要[^。！？；;\n]{1,42}也要/g },
  { label: '对于...来说...', regex: /对于[^。！？；;\n]{1,24}来说/g },
  { label: '可以说...', regex: /可以说/g },
  { label: '某种程度上...', regex: /某种程度上/g },
  { label: '在这个过程中...', regex: /在这个过程中/g },
  { label: '这意味着...', regex: /这意味着/g },
  { label: '我们需要意识到...', regex: /需要意识到/g },
  { label: '学会...', regex: /学会[^。！？；;\n]{1,18}/g },
  { label: '接纳...', regex: /接纳[^。！？；;\n]{1,18}/g },
  { label: '松弛感...', regex: /松弛感/g },
  { label: '内耗...', regex: /内耗/g },
  { label: '边界感...', regex: /边界感/g },
  { label: '情绪价值...', regex: /情绪价值/g },
  { label: '底层逻辑...', regex: /底层逻辑/g },
  { label: '长期主义...', regex: /长期主义/g },
  { label: '赋能...', regex: /赋能/g },
  { label: '你要明白...', regex: /你要明白/g },
  { label: '请记住...', regex: /请记住/g },
  { label: '愿你...', regex: /愿你/g },
  { label: '很多时候...', regex: /很多时候/g },
  { label: '本质上...', regex: /本质上/g },
  { label: '归根结底...', regex: /归根结底/g },
  { label: '真正重要的...', regex: /真正重要的/g },
  { label: '更重要的是...', regex: /更重要的是/g },
  { label: '你会发现...', regex: /你会发现/g },
  { label: '这背后...', regex: /这背后/g },
  { label: '换句话说...', regex: /换句话说/g },
  { label: '说到底...', regex: /说到底/g },
]

const concretePatterns = [
  /\d+(\.\d+)?%?/g,
  /20\d{2}年/g,
  /第[一二三四五六七八九十\d]+/g,
  /“[^”]{2,}”/g,
  /《[^》]{2,}》/g,
  /https?:\/\//g,
]

const styleStopWords = [
  '一个',
  '一种',
  '这个',
  '那个',
  '这些',
  '那些',
  '我们',
  '你们',
  '他们',
  '自己',
  '不是',
  '而是',
  '只是',
  '因为',
  '所以',
  '如果',
  '但是',
  '然后',
  '其实',
  '很多',
  '真正',
  '可能',
]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeText(text) {
  return (text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitParagraphs(text) {
  return normalizeText(text)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitSentences(text) {
  return text
    .split(/[。！？!?；;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getAverageLength(items) {
  if (!items.length) return 0
  return items.reduce((sum, item) => sum + item.length, 0) / items.length
}

function countMatches(text, patterns) {
  return patterns.reduce((total, pattern) => {
    const matches = text.match(pattern)
    return total + (matches ? matches.length : 0)
  }, 0)
}

function countPhraseHits(text) {
  return templatePhrases.reduce((total, phrase) => {
    return total + (text.includes(phrase) ? 1 : 0)
  }, 0)
}

function analyzeAiFlavor(text) {
  const labels = []
  let hits = 0

  aiFlavorPatterns.forEach((pattern) => {
    const matches = text.match(pattern.regex)
    if (matches && matches.length) {
      hits += matches.length
      labels.push(pattern.label)
    }
  })

  const parallelismHits = countParallelismHits(text)
  if (parallelismHits > 0) {
    hits += parallelismHits
    labels.push('连续排比句')
  }

  return {
    hits,
    labels: labels.slice(0, 5),
    parallelismHits,
  }
}

function countParallelismHits(text) {
  const clauses = text
    .split(/[，,；;。！？!?\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)

  let hits = 0
  let sameStartRun = 1
  let sameShapeRun = 1

  for (let index = 1; index < clauses.length; index += 1) {
    const current = clauses[index]
    const previous = clauses[index - 1]
    const sameStart = current.slice(0, 2) === previous.slice(0, 2)
    const sameShape = getClauseShape(current) === getClauseShape(previous)

    sameStartRun = sameStart ? sameStartRun + 1 : 1
    sameShapeRun = sameShape ? sameShapeRun + 1 : 1

    if (sameStartRun === 3) hits += 1
    if (sameShapeRun === 3) hits += 1
  }

  const parallelConnectors = [
    /既[^。！？；;\n]{1,24}也[^。！？；;\n]{1,24}更/g,
    /一边[^。！？；;\n]{1,24}一边/g,
    /越[^。！？；;\n]{1,18}越/g,
    /不是[^。！？；;\n]{1,24}不是[^。！？；;\n]{1,24}而是/g,
  ]

  return hits + countMatches(text, parallelConnectors)
}

function getClauseShape(clause) {
  return clause
    .replace(/[我你他她它们自己真正一个一种很多所有那些这些]/g, '')
    .replace(/\d+/g, '0')
    .slice(0, 4)
}

function getUniqueRatio(text) {
  const chars = text.replace(/\s|[，。！？；：、“”‘’（）()《》,.!?;:]/g, '').split('')
  if (!chars.length) return 0
  return new Set(chars).size / chars.length
}

function getSentenceVariance(sentences) {
  if (sentences.length < 2) return 0
  const lengths = sentences.map((item) => item.length)
  const avg = lengths.reduce((sum, item) => sum + item, 0) / lengths.length
  const variance = lengths.reduce((sum, item) => sum + Math.pow(item - avg, 2), 0) / lengths.length
  return Math.sqrt(variance) / Math.max(avg, 1)
}

function getRepeatedStartRate(sentences) {
  if (sentences.length < 3) return 0
  const starts = sentences.map((sentence) => sentence.slice(0, 2))
  const counts = starts.reduce((map, start) => {
    map[start] = (map[start] || 0) + 1
    return map
  }, {})
  const repeated = Object.keys(counts).reduce((total, key) => {
    return total + (counts[key] > 1 ? counts[key] : 0)
  }, 0)
  return repeated / sentences.length
}

function extractFrequentWords(text) {
  const cleanText = normalizeText(text).replace(/\s/g, '')
  const counts = {}

  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= cleanText.length - size; index += 1) {
      const word = cleanText.slice(index, index + size)
      if (!/^[\u4e00-\u9fa5]+$/.test(word)) continue
      if (styleStopWords.includes(word)) continue
      counts[word] = (counts[word] || 0) + 1
    }
  }

  return Object.keys(counts)
    .filter((word) => counts[word] >= 2)
    .sort((a, b) => counts[b] - counts[a] || b.length - a.length)
    .slice(0, 6)
}

function extractStarterPhrases(sentences) {
  const counts = {}
  sentences.forEach((sentence) => {
    const starter = sentence.slice(0, Math.min(5, sentence.length))
    if (starter.length < 2) return
    counts[starter] = (counts[starter] || 0) + 1
  })

  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 3)
}

function buildStyleProfile(text) {
  const cleanText = normalizeText(text)
  const paragraphs = splitParagraphs(cleanText)
  const sentences = splitSentences(cleanText)
  const avgSentenceLength = Math.round(getAverageLength(sentences))
  const avgParagraphLength = Math.round(getAverageLength(paragraphs))
  const commaCount = (cleanText.match(/，/g) || []).length
  const periodCount = (cleanText.match(/。/g) || []).length
  const exclamationCount = (cleanText.match(/！|!/g) || []).length
  const questionCount = (cleanText.match(/？|\?/g) || []).length
  const quoteCount = (cleanText.match(/“|”/g) || []).length
  const personalCount = (cleanText.match(/我|我的|自己/g) || []).length
  const secondPersonCount = (cleanText.match(/你|你的/g) || []).length
  const frequentWords = extractFrequentWords(cleanText)
  const starters = extractStarterPhrases(sentences)

  const tone = personalCount >= secondPersonCount && personalCount >= 2
    ? '个人叙述'
    : secondPersonCount >= 3
      ? '对话感'
      : '客观说明'
  const rhythm = avgSentenceLength <= 24
    ? '短句'
    : avgSentenceLength >= 42
      ? '长句'
      : '中等句长'
  const paragraphStyle = avgParagraphLength <= 120
    ? '短段'
    : avgParagraphLength >= 260
      ? '长段'
      : '中等段落'

  return {
    available: cleanText.length >= 80,
    length: cleanText.length,
    avgSentenceLength,
    avgParagraphLength,
    commaCount,
    periodCount,
    exclamationCount,
    questionCount,
    quoteCount,
    personalCount,
    secondPersonCount,
    frequentWords,
    starters,
    tone,
    rhythm,
    paragraphStyle,
    summary: `${tone} · ${rhythm} · ${paragraphStyle}`,
  }
}

function analyzeParagraph(paragraph, index) {
  const sentences = splitSentences(paragraph)
  const length = paragraph.length
  const variance = getSentenceVariance(sentences)
  const phraseHits = countPhraseHits(paragraph)
  const aiFlavor = analyzeAiFlavor(paragraph)
  const concreteHits = countMatches(paragraph, concretePatterns)
  const uniqueRatio = getUniqueRatio(paragraph)
  const repeatedStartRate = getRepeatedStartRate(sentences)
  const avgSentenceLength = sentences.length ? length / sentences.length : length

  let score = 18
  score += clamp((0.38 - variance) * 45, 0, 22)
  score += clamp(phraseHits * 8, 0, 24)
  score += clamp(aiFlavor.hits * 12, 0, 40)
  score += clamp((0.36 - uniqueRatio) * 80, 0, 18)
  score += clamp(repeatedStartRate * 24, 0, 14)
  score += avgSentenceLength > 42 ? 9 : 0
  score -= clamp(concreteHits * 4, 0, 18)
  score -= length < 80 ? 8 : 0

  const reasons = []
  if (variance < 0.28 && sentences.length > 2) reasons.push('句长变化偏小')
  if (phraseHits > 0) reasons.push('出现模板化表达')
  if (aiFlavor.hits > 0) reasons.push(`AI味句式：${aiFlavor.labels.join('、')}`)
  if (uniqueRatio < 0.36 && length > 80) reasons.push('重复度偏高')
  if (concreteHits === 0 && length > 120) reasons.push('缺少可核验细节')
  if (avgSentenceLength > 42) reasons.push('平均句长偏长')
  if (!reasons.length) reasons.push('未发现明显异常')

  const finalScore = Math.round(clamp(score, 4, 96))

  return {
    index: index + 1,
    text: paragraph,
    preview: paragraph.length > 64 ? `${paragraph.slice(0, 64)}...` : paragraph,
    score: finalScore,
    risk: finalScore >= 68 ? '高' : finalScore >= 40 ? '中' : '低',
    riskClass: finalScore >= 68 ? 'risk-high' : finalScore >= 40 ? 'risk-mid' : 'risk-low',
    reasons,
  }
}

function getRiskWeight(paragraph) {
  if (paragraph.risk === '高') return 3
  if (paragraph.risk === '中') return 2
  return 1
}

function buildReport(text, typeIndex) {
  const cleanText = normalizeText(text)
  const paragraphs = splitParagraphs(cleanText)
  const sentences = splitSentences(cleanText)
  let searchStart = 0
  const paragraphReports = paragraphs.map((paragraph, index) => {
    const report = analyzeParagraph(paragraph, index)
    const start = cleanText.indexOf(paragraph, searchStart)
    const safeStart = start >= 0 ? start : searchStart
    const end = safeStart + paragraph.length
    searchStart = end

    return {
      ...report,
      start: safeStart,
      end,
    }
  })
  const sortedParagraphReports = paragraphReports.slice().sort((left, right) => {
    return getRiskWeight(right) - getRiskWeight(left) || left.index - right.index
  })
  const average = paragraphReports.length
    ? paragraphReports.reduce((sum, item) => sum + item.score, 0) / paragraphReports.length
    : 0
  const phraseHits = countPhraseHits(cleanText)
  const aiFlavor = analyzeAiFlavor(cleanText)
  const concreteHits = countMatches(cleanText, concretePatterns)
  const variance = getSentenceVariance(sentences)
  const uniqueRatio = getUniqueRatio(cleanText)
  const typeAdjustments = [0, -4, 5, 3, -2]

  let score = average
  score += clamp(phraseHits * 2.5, 0, 12)
  score += clamp(aiFlavor.hits * 4.8, 0, 28)
  score += clamp((0.3 - variance) * 24, 0, 10)
  score += clamp((0.34 - uniqueRatio) * 38, 0, 10)
  score -= clamp(concreteHits * 1.2, 0, 10)
  score += typeAdjustments[typeIndex] || 0
  score = Math.round(clamp(score, 1, 99))

  const confidence = cleanText.length >= 900 ? '高' : cleanText.length >= 350 ? '中' : '低'
  const riskLevel = score >= 68 ? '高风险' : score >= 40 ? '中风险' : '低风险'
  const riskClass = score >= 68 ? 'risk-high' : score >= 40 ? 'risk-mid' : 'risk-low'

  const reasons = []
  if (aiFlavor.hits >= 2) reasons.push(`命中 ${aiFlavor.hits} 处高 AI 味句式：${aiFlavor.labels.join('、')}`)
  if (aiFlavor.parallelismHits >= 1) reasons.push('存在连续排比或相似句式堆叠，文本呈现较强生成式文案节奏')
  if (phraseHits >= 3) reasons.push('多次出现 AI 写作中常见的过渡和总结句式')
  if (variance < 0.28 && sentences.length > 4) reasons.push('句子长度和段落推进较均匀')
  if (concreteHits <= 1 && cleanText.length > 300) reasons.push('可验证的事实、数据、引用或个人经验细节偏少')
  if (uniqueRatio < 0.35 && cleanText.length > 300) reasons.push('词字多样性偏低，存在重复组织语言的迹象')
  if (paragraphReports.filter((item) => item.score >= 68).length >= 2) reasons.push('多个段落同时触发高风险信号')
  if (!reasons.length) reasons.push('文本有一定自然波动，未集中触发高风险信号')

  const suggestions = score >= 68
    ? ['要求作者补充写作过程或引用来源', '优先复核高风险段落', '不要把结果作为唯一处罚依据']
    : score >= 40
      ? ['抽查中高风险段落', '检查关键事实和引用是否真实', '结合作者历史风格再判断']
      : ['可作为低风险文本处理', '如用于考试或合规场景，仍建议保留人工复核入口']

  return {
    score,
    confidence,
    riskLevel,
    riskClass,
    wordCount: cleanText.length,
    aiFlavorHits: aiFlavor.hits,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    reasons,
    suggestions,
    paragraphs: sortedParagraphReports,
    summary: `AI 生成概率 ${score}%，${riskLevel}，置信度${confidence}。`,
  }
}

function cleanClause(text) {
  return String(text || '')
    .replace(/^[，,。；;\s]+|[，,。；;\s]+$/g, '')
    .trim()
}

function softenAction(text) {
  const action = cleanClause(text)
  if (action.indexOf('停止') === 0) {
    return `${action.replace(/^停止/, '')}的冲动也会少一些`
  }
  return `${action}也会慢慢少一些`
}

function humanizeText(text) {
  let output = normalizeText(text)
  const changes = []

  const replacements = [
    {
      label: '弱化“需要的不是...而是...”句式',
      regex: /(真正)?需要的不是([^。！？；;\n]{1,42})，?而是([^。！？；;\n]{1,56})/g,
      replace: (match, prefix, first, second) => `${prefix ? '真正需要的' : '需要的'}，可能更接近于${cleanClause(second)}；${cleanClause(first)}未必是答案`,
    },
    {
      label: '弱化“不取决于...而取决于...”句式',
      regex: /不取决于([^。！？；;\n]{1,42})，?而取决于([^。！？；;\n]{1,56})/g,
      replace: (match, first, second) => `${cleanClause(second)}，比${cleanClause(first)}更值得参考`,
    },
    {
      label: '弱化“不是因为...只是...”句式',
      regex: /(?:也)?不是因为([^。！？；;\n]{1,42})，?只是([^。！？；;\n]{1,56})/g,
      replace: (match, first, second) => `这未必是因为${cleanClause(first)}，更多是${cleanClause(second)}`,
    },
    {
      label: '弱化“不是因为...而是因为...”句式',
      regex: /(?:也)?不是因为([^。！？；;\n]{1,42})，?而是因为([^。！？；;\n]{1,56})/g,
      replace: (match, first, second) => `原因未必只有${cleanClause(first)}，也可能是${cleanClause(second)}`,
    },
    {
      label: '弱化“不是...而是...”反转句',
      regex: /(?:并)?(?:也)?不是([^。！？；;\n]{1,42})，?而是([^。！？；;\n]{1,56})/g,
      replace: (match, first, second) => `${cleanClause(second)}，可能比${cleanClause(first)}更接近真实情况`,
    },
    {
      label: '弱化“不是...只是...”解释句',
      regex: /(?:也)?不是([^。！？；;\n]{1,42})，?只是([^。！？；;\n]{1,56})/g,
      replace: (match, first, second) => `看起来像${cleanClause(first)}，实际更多是${cleanClause(second)}`,
    },
    {
      label: '弱化“与其...不如...”句式',
      regex: /与其([^。！？；;\n]{1,42})，?不如([^。！？；;\n]{1,56})/g,
      replace: (match, first, second) => `可以少一点${cleanClause(first)}，多一点${cleanClause(second)}`,
    },
    {
      label: '弱化“你以为...其实...”句式',
      regex: /你以为([^。！？；;\n]{1,42})，?其实([^。！？；;\n]{1,56})/g,
      replace: (match, first, second) => `有时看起来${cleanClause(first)}，但里面也有${cleanClause(second)}`,
    },
  ]

  replacements.forEach((rule) => {
    let matched = false
    output = output.replace(rule.regex, (...args) => {
      matched = true
      return rule.replace(...args)
    })
    if (matched) changes.push(rule.label)
  })

  const phraseRules = [
    { from: /很多时候，?/g, to: '有时候，', label: '减少高频开场词' },
    { from: /真正重要的，?/g, to: '更要紧的是，', label: '替换抽象判断句' },
    { from: /你会发现，?/g, to: '慢慢地会感觉到，', label: '替换教导式表达' },
    { from: /本质上，?/g, to: '说得具体一点，', label: '替换宏大概括词' },
    { from: /归根结底，?/g, to: '回到这件事本身，', label: '替换总结套话' },
    { from: /综上所述，?/g, to: '所以回头看，', label: '替换总结套话' },
    { from: /总而言之，?/g, to: '简单说，', label: '替换总结套话' },
    { from: /值得注意的是，?/g, to: '这里有一点需要留意：', label: '替换书面套话' },
  ]

  phraseRules.forEach((rule) => {
    if (rule.from.test(output)) {
      changes.push(rule.label)
      output = output.replace(rule.from, rule.to)
    }
  })

  const beforeParallel = output
  output = softenParallelism(output)
  if (output !== beforeParallel) changes.push('拆散连续排比')

  output = output
    .replace(/；/g, '。')
    .replace(/，{2,}/g, '，')
    .replace(/,{2,}/g, '，')
    .replace(/，,/g, '，')
    .replace(/,，/g, '，')
    .replace(/。{2,}/g, '。')
    .replace(/，。/g, '。')
    .replace(/，\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    text: output,
    changes: Array.from(new Set(changes)),
  }
}

function softenParallelism(text) {
  return text.replace(/当一个人开始([^。！？\n]{8,120})，他/g, (match, middle) => {
    const parts = middle
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean)

    if (parts.length < 3) return match

    const firstAction = parts[0].indexOf('停止') === 0
      ? parts[0].replace(/^停止/, '不再')
      : parts[0]

    const softened = [
      `当一个人开始${firstAction}时，${softenAction(parts[1])}`,
      `至于${parts.slice(2).join('，')}，可以一点点放下`,
    ].join('。')

    return `${softened}。他`
  })
}

function splitSentenceWithPunctuation(text) {
  const matches = normalizeText(text).match(/[^。！？!?]+[。！？!?]?/g)
  return matches ? matches.map((item) => item.trim()).filter(Boolean) : []
}

function adaptToReferenceStyle(text, profile) {
  if (!profile || !profile.available) {
    return {
      text,
      changes: [],
    }
  }

  let output = normalizeText(text)
  const changes = ['套用参考文章风格画像']

  if (profile.tone === '个人叙述') {
    output = output
      .replace(/你参与/g, '我参与')
      .replace(/你维持/g, '我维持')
      .replace(/你会/g, '我会')
      .replace(/让你/g, '让我')
      .replace(/你的/g, '我的')
      .replace(/当一个人开始/g, '当我开始')
      .replace(/他反而/g, '我反而')
      .replace(/你/g, '我')
    changes.push('调整为个人叙述口吻')
  } else if (profile.tone === '客观说明') {
    output = output
      .replace(/我/g, '人')
      .replace(/你/g, '人')
    changes.push('调整为客观说明口吻')
  } else {
    changes.push('保留对话感表达')
  }

  if (profile.rhythm === '短句') {
    output = output
      .replace(/，可能/g, '。可能')
      .replace(/，更多是/g, '。更多是')
      .replace(/，实际/g, '。实际')
      .replace(/，比/g, '。比')
    changes.push('压短句子节奏')
  } else if (profile.rhythm === '长句') {
    output = output
      .replace(/。更多是/g, '，更多是')
      .replace(/。可能/g, '，可能')
      .replace(/。比/g, '，比')
    changes.push('保留长句推进')
  }

  if (profile.frequentWords.length) {
    output = tuneReferenceVocabulary(output, profile.frequentWords)
    changes.push(`参考常用词：${profile.frequentWords.slice(0, 3).join('、')}`)
  }

  if (profile.paragraphStyle === '短段') {
    output = splitIntoShortParagraphs(output)
    changes.push('按参考文拆成短段')
  } else if (profile.paragraphStyle === '长段') {
    output = output.replace(/\n{2,}/g, '\n\n')
    changes.push('保留较完整段落')
  }

  return {
    text: normalizeText(output),
    changes,
  }
}

function tuneReferenceVocabulary(text, words) {
  let output = text
  const wordSet = words.join('|')

  if (/慢慢|一点点/.test(wordSet)) {
    output = output.replace(/逐渐/g, '慢慢').replace(/一点点/g, '慢慢')
  }

  if (/细节|具体|小事/.test(wordSet)) {
    output = output.replace(/真实情况/g, '具体感受').replace(/答案/g, '那个具体的感受')
  }

  if (/情绪|感受/.test(wordSet)) {
    output = output.replace(/更接近真实情况/g, '更贴近当时的感受')
  }

  if (/场景|瞬间/.test(wordSet)) {
    output = output.replace(/所以回头看/g, '放回具体场景里看')
  }

  return output
}

function splitIntoShortParagraphs(text) {
  const sentences = splitSentenceWithPunctuation(text)
  const groups = []

  for (let index = 0; index < sentences.length; index += 2) {
    groups.push(sentences.slice(index, index + 2).join(''))
  }

  return groups.join('\n\n')
}

function buildQualityReport(text, profile, changes) {
  const cleanText = normalizeText(text)
  const sentences = splitSentences(cleanText)
  const paragraphs = splitParagraphs(cleanText)
  const aiFlavor = analyzeAiFlavor(cleanText)
  const phraseHits = countPhraseHits(cleanText)
  const repeatedStartRate = getRepeatedStartRate(sentences)
  const avgSentenceLength = getAverageLength(sentences)
  const awkwardHits = countAwkwardHits(cleanText, sentences)
  const longSentenceCount = sentences.filter((sentence) => sentence.length > 58).length
  const shortFragmentCount = sentences.filter((sentence) => sentence.length > 0 && sentence.length < 6).length

  const fluencyScore = Math.round(clamp(
    96 - awkwardHits * 18 - longSentenceCount * 5 - shortFragmentCount * 8,
    1,
    99
  ))
  const humanScore = Math.round(clamp(
    94 - aiFlavor.hits * 12 - phraseHits * 8 - repeatedStartRate * 28 + Math.min(paragraphs.length, 4) * 2,
    1,
    99
  ))
  const styleScore = profile && profile.available
    ? getStyleMatchScore(cleanText, profile, changes)
    : null

  const items = [
    {
      label: '语句通顺',
      score: fluencyScore,
      displayValue: `${fluencyScore}分`,
      status: fluencyScore >= 80 ? '通过' : fluencyScore >= 62 ? '需复核' : '需重改',
      detail: awkwardHits
        ? `发现 ${awkwardHits} 处可能不顺的标点或断句`
        : '未发现明显断句、重复标点或生硬片段',
    },
    {
      label: '说人话',
      score: humanScore,
      displayValue: `${humanScore}分`,
      status: humanScore >= 80 ? '通过' : humanScore >= 62 ? '需复核' : '需重改',
      detail: aiFlavor.hits
        ? `仍残留 ${aiFlavor.hits} 处 AI 味句式`
        : 'AI 腔句式已明显减少，表达更接近日常写作',
    },
  ]

  if (profile && profile.available) {
    items.push({
      label: '参考风格',
      score: styleScore,
      displayValue: `${styleScore}分`,
      status: styleScore >= 72 ? '已使用' : styleScore >= 52 ? '部分使用' : '不明显',
      detail: `参考了${profile.summary}，并检查口吻、句长和段落习惯`,
    })
  } else {
    items.push({
      label: '参考风格',
      score: 0,
      displayValue: '未提供',
      status: '未提供',
      detail: '未输入参考文章，当前按通用去 AI 味规则处理',
    })
  }

  const passed = items.filter((item) => ['通过', '已使用'].includes(item.status)).length

  return {
    items,
    summary: passed >= 2 ? '改写复检通过' : '改写后仍建议人工看一遍',
  }
}

function countAwkwardHits(text, sentences) {
  const punctuationIssues = countMatches(text, [
    /，，/g,
    /。。/g,
    /，。/g,
    /、。/g,
    /的的/g,
    /是是/g,
    /当我开始[^。！？]{0,8}。/g,
    /当一个人开始[^。！？]{0,8}。/g,
  ])
  const abruptFragments = sentences.filter((sentence) => {
    return sentence.length >= 3 && sentence.length <= 8 && /^(至于|所以|但是|而且|然后|因为)/.test(sentence)
  }).length

  return punctuationIssues + abruptFragments
}

function getStyleMatchScore(text, profile, changes) {
  const currentProfile = buildStyleProfile(text)
  let score = 38

  if (currentProfile.tone === profile.tone) score += 22
  if (currentProfile.paragraphStyle === profile.paragraphStyle) score += 18
  if (Math.abs(currentProfile.avgSentenceLength - profile.avgSentenceLength) <= 10) score += 14
  if (changes.some((change) => change.indexOf('套用参考文章风格画像') >= 0)) score += 8

  const wordHits = profile.frequentWords.filter((word) => text.indexOf(word) >= 0).length
  score += Math.min(wordHits * 4, 12)

  return Math.round(clamp(score, 1, 99))
}

function markSelectedParagraph(result, selectedIndex) {
  if (!result || !result.paragraphs) return result

  return {
    ...result,
    paragraphs: result.paragraphs.map((paragraph) => {
      return {
        ...paragraph,
        selected: paragraph.index === selectedIndex,
      }
    }),
  }
}

Page({
  data: {
    articleTypes,
    typeIndex: 0,
    articleText: '',
    referenceText: '',
    styleProfile: null,
    result: null,
    humanizedText: '',
    humanizedResult: null,
    humanizeChanges: [],
    qualityReport: null,
    analyzing: false,
    humanizing: false,
    hasDetected: false,
    selectedParagraphIndex: 0,
    selectedParagraphText: '',
    scrollTarget: '',
    maxLength: 6000,
    sampleText: '很多时候，我们真正需要的不是远离所有人，而是靠近真正值得的人。你参与某个局，也不是因为真的开心，只是不好意思拒绝；你维持一段关系，也不是因为它有价值，只是害怕显得冷漠。\n\n真正重要的，不是把自己封闭起来，而是把自己从消耗里解救出来。你会发现，当一个人开始停止讨好，停止解释，停止把别人的情绪扛在自己身上，他反而更容易找回生活的秩序。\n\n综上所述，一段关系是否值得继续，不取决于它看起来多热闹，而取决于它是否让你变得松弛、清醒和稳定。',
  },

  onTypeChange(event) {
    this.setData({
      typeIndex: Number(event.detail.value),
    })
  },

  onInput(event) {
    this.setData({
      articleText: event.detail.value,
      result: null,
      humanizedText: '',
      humanizedResult: null,
      humanizeChanges: [],
      qualityReport: null,
      selectedParagraphIndex: 0,
      selectedParagraphText: '',
      scrollTarget: '',
    })
  },

  onReferenceInput(event) {
    const referenceText = event.detail.value
    const styleProfile = buildStyleProfile(referenceText)

    this.setData({
      referenceText,
      styleProfile: styleProfile.available ? styleProfile : null,
      humanizedText: '',
      humanizedResult: null,
      humanizeChanges: [],
      qualityReport: null,
    })
  },

  useSample() {
    this.setData({
      articleText: this.data.sampleText,
      result: null,
      humanizedText: '',
      humanizedResult: null,
      humanizeChanges: [],
      qualityReport: null,
      selectedParagraphIndex: 0,
      selectedParagraphText: '',
      scrollTarget: '',
    })
  },

  clearText() {
    this.setData({
      articleText: '',
      result: null,
      humanizedText: '',
      humanizedResult: null,
      humanizeChanges: [],
      qualityReport: null,
      hasDetected: false,
      selectedParagraphIndex: 0,
      selectedParagraphText: '',
      scrollTarget: '',
    })
  },

  clearReference() {
    this.setData({
      referenceText: '',
      styleProfile: null,
      humanizedText: '',
      humanizedResult: null,
      humanizeChanges: [],
      qualityReport: null,
    })
  },

  analyze() {
    const text = normalizeText(this.data.articleText)
    if (text.length < 80) {
      wx.showToast({
        title: '至少输入80字',
        icon: 'none',
      })
      return
    }

    this.setData({ analyzing: true })
    const result = buildReport(text, this.data.typeIndex)
    setTimeout(() => {
      this.setData({
        result,
        articleText: text,
        humanizedText: '',
        humanizedResult: null,
        humanizeChanges: [],
        qualityReport: null,
        hasDetected: true,
        selectedParagraphIndex: 0,
        selectedParagraphText: '',
        scrollTarget: '',
        analyzing: false,
      })
    }, 240)
  },

  locateParagraph(event) {
    const start = Number(event.currentTarget.dataset.start)
    const end = Number(event.currentTarget.dataset.end)
    const index = Number(event.currentTarget.dataset.index)
    if (Number.isNaN(start) || Number.isNaN(end)) return
    const selectedParagraphText = this.data.articleText.slice(start, end)

    this.setData({
      result: markSelectedParagraph(this.data.result, index),
      selectedParagraphIndex: index,
      selectedParagraphText,
      scrollTarget: 'article-editor',
    })

    setTimeout(() => {
      this.setData({ scrollTarget: '' })
    }, 300)

    wx.showToast({
      title: `已定位第${index}段`,
      icon: 'none',
    })
  },

  reduceAiFlavor() {
    const text = normalizeText(this.data.articleText)
    if (!this.data.result || !text) {
      wx.showToast({
        title: '请先检测文章',
        icon: 'none',
      })
      return
    }

    this.setData({ humanizing: true })
    const humanized = humanizeText(text)
    const styled = adaptToReferenceStyle(humanized.text, this.data.styleProfile)
    const finalText = styled.text
    const humanizedResult = buildReport(finalText, this.data.typeIndex)
    const changes = humanized.changes.concat(styled.changes)
    const qualityReport = buildQualityReport(finalText, this.data.styleProfile, changes)

    setTimeout(() => {
      this.setData({
        humanizedText: finalText,
        humanizedResult,
        humanizeChanges: changes.length ? Array.from(new Set(changes)) : ['未命中明显可替换句式，建议人工补充具体经历和细节'],
        qualityReport,
        humanizing: false,
      })
    }, 260)
  },

  useHumanizedText() {
    if (!this.data.humanizedText) return

    this.setData({
      articleText: this.data.humanizedText,
      result: this.data.humanizedResult,
      humanizedText: '',
      humanizedResult: null,
      humanizeChanges: [],
      qualityReport: null,
      hasDetected: true,
      selectedParagraphIndex: 0,
      selectedParagraphText: '',
      scrollTarget: '',
    })
  },

  copyHumanizedText() {
    if (!this.data.humanizedText) return

    wx.setClipboardData({
      data: this.data.humanizedText,
      success: () => {
        wx.showToast({
          title: '改写稿已复制',
          icon: 'success',
        })
      },
    })
  },

  copyReport() {
    const { result, qualityReport } = this.data
    if (!result) {
      wx.showToast({
        title: '请先检测文章',
        icon: 'none',
      })
      return
    }

    const report = [
      result.summary,
      `文本长度：${result.wordCount} 字`,
      `段落数：${result.paragraphCount}`,
      `AI味句式：${result.aiFlavorHits} 处`,
      `主要原因：${result.reasons.join('；')}`,
      `建议：${result.suggestions.join('；')}`,
      qualityReport ? `改写复检：${qualityReport.summary}（${qualityReport.items.map((item) => `${item.label}${item.displayValue}${item.status}`).join('；')}）` : '',
      '提示：检测结果仅用于辅助判断，不能作为唯一判定依据。',
    ].filter(Boolean).join('\n')

    wx.setClipboardData({
      data: report,
      success: () => {
        wx.showToast({
          title: '报告已复制',
          icon: 'success',
        })
      },
    })
  },
})
