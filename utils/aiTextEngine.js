const STORAGE_KEYS = {
  currentAnalysis: 'ai_text_lab_current_analysis',
  currentOptimize: 'ai_text_lab_current_optimize',
  history: 'ai_text_lab_history',
  deepSeekConfig: 'ai_text_lab_deepseek_config',
}

const localDetector = require('./aiDetector')
const rewritePipeline = require('../core/pipeline/rewritePipeline')
const deepSeekClient = require('./deepSeekClient')

const templatePhrases = [
  '综上所述', '总而言之', '不难看出', '值得注意的是', '在当今社会', '随着时代的发展',
  '具有重要意义', '提供了新的思路', '进一步推动', '不可忽视', '本文将从', '以下几个方面',
  '无论是', '不仅如此', '与此同时', '因此', '然而', '此外', '可以说', '某种程度上',
  '在这个过程中', '这意味着', '需要意识到', '归根结底', '本质上', '换句话说', '说到底',
]

const aiFlavorPatterns = [
  { label: '不是...而是...', regex: /不是[^。！？；;\n]{1,46}而是/g, weight: 8, type: '句式指纹' },
  { label: '不是...只是...', regex: /不是[^。！？；;\n]{1,46}只是/g, weight: 7, type: '句式指纹' },
  { label: '不是因为...只是...', regex: /不是因为[^。！？；;\n]{1,46}只是/g, weight: 8, type: '句式指纹' },
  { label: '不是因为...而是因为...', regex: /不是因为[^。！？；;\n]{1,46}而是因为/g, weight: 8, type: '句式指纹' },
  { label: '真正的...不是...而是...', regex: /真正的[^。！？；;\n]{1,32}不是[^。！？；;\n]{1,46}而是/g, weight: 8, type: '句式指纹' },
  { label: '所谓...不是...而是...', regex: /所谓[^。！？；;\n]{1,32}不是[^。！？；;\n]{1,46}而是/g, weight: 8, type: '句式指纹' },
  { label: '与其...不如...', regex: /与其[^。！？；;\n]{1,46}不如/g, weight: 6, type: '对照结构' },
  { label: '你以为...其实...', regex: /你以为[^。！？；;\n]{1,46}其实/g, weight: 6, type: '转折模板' },
  { label: '一方面...另一方面...', regex: /一方面[^。！？\n]{1,70}另一方面/g, weight: 6, type: '结构模板' },
  { label: '首先...其次...最后...', regex: /首先[^。！？\n]{1,90}其次[^。！？\n]{1,90}(最后|总之|因此)/g, weight: 7, type: '结构模板' },
  { label: '从...到...再到...', regex: /从[^。！？；;\n]{1,28}到[^。！？；;\n]{1,28}再到/g, weight: 5, type: '排比结构' },
  { label: '既要...也要...', regex: /既要[^。！？；;\n]{1,46}也要/g, weight: 5, type: '并列结构' },
  { label: '对于...来说...', regex: /对于[^。！？；;\n]{1,28}来说/g, weight: 4, type: '泛化表达' },
  { label: '你要明白...', regex: /你要明白/g, weight: 5, type: '口吻模板' },
  { label: '愿你...', regex: /愿你/g, weight: 4, type: '鸡汤口吻' },
  { label: '长期主义', regex: /长期主义/g, weight: 5, type: '概念词' },
  { label: '底层逻辑', regex: /底层逻辑/g, weight: 5, type: '概念词' },
  { label: '情绪价值', regex: /情绪价值/g, weight: 4, type: '概念词' },
  { label: '内耗', regex: /内耗/g, weight: 3, type: '概念词' },
  { label: '松弛感', regex: /松弛感/g, weight: 3, type: '概念词' },
]

const concretePatterns = [/\d+(\.\d+)?%?/g, /20\d{2}年/g, /第[一二三四五六七八九十\d]+/g, /“[^”]{2,}”/g, /《[^》]{2,}》/g, /https?:\/\//g]
const humanSignalPatterns = [/我/g, /我们/g, /当时/g, /后来/g, /最近/g, /今天/g, /比如/g, /举个例子/g, /说实话/g, /坦白讲/g, /具体来看/g, /放到具体场景/g]

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizeText(text) {
  return (text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function splitParagraphs(text) {
  return normalizeText(text).split(/\n+/).map((item) => item.trim()).filter(Boolean)
}

function splitSentences(text) {
  return normalizeText(text).split(/[。！？!?；;\n]+/).map((item) => item.trim()).filter(Boolean)
}

function countMatches(text, regex) {
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function getUniqueRatio(text) {
  const chars = normalizeText(text).replace(/\s|[，。！？；：、“”‘’（）()《》,.!?;:]/g, '').split('')
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

function getClauseShape(clause) {
  return clause.replace(/[我你他她它们自己真正一个一种很多所有那些这些]/g, '').replace(/\d+/g, '0').slice(0, 4)
}

function countParallelismHits(text) {
  const clauses = normalizeText(text).split(/[，,；;。！？!?\n]/).map((item) => item.trim()).filter((item) => item.length >= 6)
  let hits = 0
  let sameStartRun = 1
  let sameShapeRun = 1
  for (let index = 1; index < clauses.length; index += 1) {
    const current = clauses[index]
    const previous = clauses[index - 1]
    sameStartRun = current.slice(0, 2) === previous.slice(0, 2) ? sameStartRun + 1 : 1
    sameShapeRun = getClauseShape(current) === getClauseShape(previous) ? sameShapeRun + 1 : 1
    if (sameStartRun === 3) hits += 1
    if (sameShapeRun === 3) hits += 1
  }
  return hits + countMatches(text, /既[^。！？；;\n]{1,24}也[^。！？；;\n]{1,24}更/g) + countMatches(text, /越[^。！？；;\n]{1,18}越/g)
}

function collectPatternHits(text) {
  const details = []
  let score = 0
  aiFlavorPatterns.forEach((pattern) => {
    const matches = text.match(pattern.regex)
    if (matches && matches.length) {
      score += matches.length * pattern.weight
      details.push({ label: pattern.label, count: matches.length, type: pattern.type, weight: pattern.weight })
    }
  })
  const templateCount = templatePhrases.reduce((total, phrase) => total + (text.indexOf(phrase) >= 0 ? 1 : 0), 0)
  if (templateCount) {
    score += templateCount * 4
    details.push({ label: '总结/过渡套话', count: templateCount, type: '模板表达', weight: 4 })
  }
  const parallelismHits = countParallelismHits(text)
  if (parallelismHits) {
    score += parallelismHits * 7
    details.push({ label: '连续排比或相似句式堆叠', count: parallelismHits, type: '节奏结构', weight: 7 })
  }
  return { score, details: details.sort((a, b) => b.count * b.weight - a.count * a.weight) }
}

function classifyRisk(score) {
  if (score >= 85) return { riskLevel: 'AI痕迹极高频', riskClass: 'high', riskText: '极高频', rank: 6 }
  if (score >= 70) return { riskLevel: 'AI痕迹高频', riskClass: 'high', riskText: '高频', rank: 5 }
  if (score >= 45) return { riskLevel: 'AI痕迹一般', riskClass: 'medium', riskText: '一般', rank: 4 }
  if (score >= 25) return { riskLevel: 'AI痕迹较低', riskClass: 'low', riskText: '较低', rank: 3 }
  if (score >= 5) return { riskLevel: 'AI痕迹低', riskClass: 'low', riskText: '低', rank: 2 }
  return { riskLevel: 'AI痕迹极低', riskClass: 'low', riskText: '极低', rank: 1 }
}

function makeSuggestion(labels) {
  if ((labels || []).some((item) => item.indexOf('不是') >= 0)) return '减少“不是…而是…”式对照，改成具体场景、动作或个人观察。'
  if ((labels || []).some((item) => item.indexOf('排比') >= 0)) return '打散连续排比，保留一两个重点句，其余改成自然叙述。'
  if ((labels || []).some((item) => item.indexOf('套话') >= 0 || item.indexOf('模板') >= 0)) return '删掉泛泛总结，补充更具体的事件、对象、时间或细节。'
  return '加入更明确的主体、场景和判断依据，让表达更像真实写作。'
}

function optimizeSentence(sentence) {
  return sentence
    .replace(/不是([^，。！？；;\n]{1,32})，?而是/g, '比起$1，更像是')
    .replace(/不是([^，。！？；;\n]{1,32})，?只是/g, '表面上$1，实际更接近')
    .replace(/综上所述|总而言之|不难看出|值得注意的是/g, '')
    .replace(/在当今社会|随着时代的发展/g, '现在')
    .replace(/具有重要意义/g, '很重要')
    .replace(/这意味着/g, '也就是说')
    .replace(/需要意识到/g, '得承认')
    .trim()
}

function buildIssues(paragraphs) {
  const issues = []
  paragraphs.forEach((paragraph) => {
    const sentences = splitSentences(paragraph.text)
    sentences.forEach((sentence, sentenceIndex) => {
      const hit = collectPatternHits(sentence)
      const lengthScore = sentence.length > 58 ? 10 : 0
      const score = clamp(24 + Math.round(hit.score * 1.8) + lengthScore, 0, 98)
      if (score >= 38 || hit.details.length) {
        const risk = classifyRisk(score)
        const labels = hit.details.map((item) => item.label).slice(0, 4)
        issues.push({
          id: `${paragraph.index}-${sentenceIndex}`,
          paragraphIndex: paragraph.index,
          order: issues.length + 1,
          text: sentence,
          score,
          labels: labels.length ? labels : ['表达偏模板化'],
          risk: risk.riskText,
          riskClass: risk.riskClass,
          riskRank: risk.rank,
          problem: labels.length ? `命中 ${labels.join('、')}，读感偏模板。` : '句子较长且抽象，缺少具体语境。',
          suggestion: makeSuggestion(labels),
          example: optimizeSentence(sentence) || sentence,
          expanded: false,
        })
      }
    })
  })
  return issues.sort((a, b) => b.riskRank - a.riskRank || a.order - b.order)
}

function analyzeArticle(text, options = {}) {
  const normalized = normalizeText(text)
  const paragraphsText = splitParagraphs(normalized)
  const sentences = splitSentences(normalized)
  const wordCount = normalized.replace(/\s/g, '').length
  const averageSentenceLength = sentences.length ? sentences.reduce((sum, item) => sum + item.length, 0) / sentences.length : 0
  const uniqueRatio = getUniqueRatio(normalized)
  const variance = getSentenceVariance(sentences)
  const wholeHits = collectPatternHits(normalized)
  const concreteHits = concretePatterns.reduce((total, pattern) => total + countMatches(normalized, pattern), 0)
  const humanSignalHits = humanSignalPatterns.reduce((total, pattern) => total + countMatches(normalized, pattern), 0)

  let score = 18
  score += Math.min(Math.round(wholeHits.score * 1.7), 58)
  if (averageSentenceLength > 34) score += 10
  if (averageSentenceLength > 48) score += 8
  if (variance < 0.32 && sentences.length >= 6) score += 9
  if (uniqueRatio < 0.28 && wordCount > 260) score += 8
  if (wordCount > 300 && concreteHits <= 1) score += 8
  if (humanSignalHits > 0) score -= Math.min(14, humanSignalHits * 3)
  if (concreteHits >= 2) score -= 5
  if (wordCount < 100) score = Math.max(12, score - 2)
  let localDetection = null
  try {
    localDetection = localDetector.detectLocal(normalized, { include_heatmap: true, threshold: 0.5 })
    const localScore = Math.round((localDetection.overall_ai_score || 0) * 100)
    const blendWeight = wordCount < 80 ? 0.18 : 0.32
    score = Math.round(score * (1 - blendWeight) + localScore * blendWeight)
  } catch (error) {
    localDetection = null
  }
  score = clamp(Math.round(score), 3, 96)

  const paragraphs = paragraphsText.map((paragraph, index) => {
    const hit = collectPatternHits(paragraph)
    const pSentences = splitSentences(paragraph)
    const pAvg = pSentences.length ? pSentences.reduce((sum, item) => sum + item.length, 0) / pSentences.length : paragraph.length
    let pScore = 20 + Math.round(hit.score * 1.6)
    if (pAvg > 42) pScore += 9
    if (countParallelismHits(paragraph) > 0) pScore += 10
    if (paragraph.length > 180 && concretePatterns.reduce((total, pattern) => total + countMatches(paragraph, pattern), 0) === 0) pScore += 8
    pScore = clamp(Math.round(pScore), 8, 96)
    const risk = classifyRisk(pScore)
    const labels = hit.details.map((item) => item.label).slice(0, 3)
    return {
      index: index + 1,
      order: index + 1,
      text: paragraph,
      preview: paragraph.length > 76 ? `${paragraph.slice(0, 76)}...` : paragraph,
      score: pScore,
      risk: risk.riskText,
      riskClass: risk.riskClass,
      riskRank: risk.rank,
      reasons: labels.length ? labels : ['抽象表达偏多'],
      suggestion: makeSuggestion(labels),
    }
  }).sort((a, b) => b.riskRank - a.riskRank || a.order - b.order)

  let issues = buildIssues(paragraphs.map((item) => ({ ...item, index: item.order })))
  const risk = classifyRisk(score)
  const sourceAnalysis = wholeHits.details.slice(0, 5).map((item) => ({
    title: item.label,
    desc: `${item.type}命中 ${item.count} 次，容易让文章显得规整但缺少真实语境。`,
    count: item.count,
    riskClass: item.weight >= 7 ? 'high' : item.weight >= 5 ? 'medium' : 'low',
  }))
  if (wordCount > 300 && concreteHits <= 1) {
    sourceAnalysis.push({ title: '缺少具体细节', desc: '数据、时间、人物、引用或亲历信息偏少。', count: 1, riskClass: 'medium' })
  }
  if (localDetection && localDetection.metadata && localDetection.metadata.component_scores) {
    const component = localDetection.metadata.component_scores
    if (component.statistical >= 0.62) {
      sourceAnalysis.push({
        title: '统计分布偏规整',
        desc: '熵值、突发系数、词频分布等本地检测特征显示文本节奏偏稳定。',
        count: 1,
        riskClass: component.statistical >= 0.78 ? 'high' : 'medium',
      })
    }
    if (component.semantic >= 0.56) {
      sourceAnalysis.push({
        title: '语义过渡偏平滑',
        desc: '相邻句之间的词汇和语义衔接过于稳定，容易显得像机器生成。',
        count: 1,
        riskClass: component.semantic >= 0.7 ? 'high' : 'medium',
      })
    }
  }
  if (!issues.length && sourceAnalysis.length && paragraphs.length) {
    const paragraph = paragraphs[0]
    const fallbackSentence = splitSentences(paragraph.text)[0] || paragraph.text
    const issueRisk = classifyRisk(Math.max(score, paragraph.score || 0))
    issues = [{
      id: `${paragraph.order || paragraph.index}-fallback`,
      paragraphIndex: paragraph.order || paragraph.index,
      order: 1,
      text: fallbackSentence,
      score: Math.max(score, paragraph.score || 0),
      labels: sourceAnalysis.map((item) => item.title).slice(0, 4),
      risk: issueRisk.riskText,
      riskClass: issueRisk.riskClass,
      riskRank: issueRisk.rank,
      problem: `对应AI痕迹分析：${sourceAnalysis.map((item) => item.title).slice(0, 3).join('、')}。`,
      suggestion: '补充更具体的场景、事实、人物动作或个人判断依据。',
      example: optimizeSentence(fallbackSentence) || fallbackSentence,
      expanded: false,
    }]
  }

  const reasons = []
  if (wholeHits.details.length) reasons.push(`命中 ${wholeHits.details.length} 类AI味句式信号`)
  if (countParallelismHits(normalized)) reasons.push('存在排比或相似句式连续堆叠')
  if (averageSentenceLength > 34) reasons.push('平均句长偏长，阅读节奏较机械')
  if (wordCount > 300 && concreteHits <= 1) reasons.push('具体事实和个人经验密度偏低')
  if (!reasons.length) reasons.push('未发现明显高频AI句式，建议继续人工复核')

  return {
    id: `analysis_${Date.now()}`,
    text: normalized,
    title: options.title || (sentences[0] ? sentences[0].slice(0, 18) : '未命名文章'),
    articleType: options.articleType || '通用文本',
    score,
    beforeScore: score,
    probability: score,
    confidence: wordCount < 100 ? '较低' : wordCount < 300 ? '中等' : '较高',
    wordCount,
    paragraphCount: paragraphsText.length,
    sentenceCount: sentences.length,
    aiFlavorHits: wholeHits.details.reduce((sum, item) => sum + item.count, 0),
    aiFlavorDetails: wholeHits.details.slice(0, 8),
    sourceAnalysis,
    paragraphs,
    issues,
    highRiskSentences: issues.slice(0, 8),
    reasons,
    detector: localDetection ? {
      mode: 'local-js-ensemble',
      overallScore: localDetection.overall_ai_score,
      confidence: localDetection.confidence,
      confidenceInterval: localDetection.confidence_interval,
      componentScores: localDetection.metadata.component_scores,
      heatmapData: localDetection.heatmap_data || [],
      statisticalFeatures: localDetection.metadata.statistical_features,
      semanticFeatures: localDetection.metadata.deep_learning_features,
    } : null,
    createdAt: Date.now(),
    ...risk,
  }
}

function extractStyleProfile(referenceText) {
  const text = normalizeText(referenceText)
  if (!text) return null
  const paragraphs = splitParagraphs(text)
  const sentences = splitSentences(text)
  const avg = sentences.length ? Math.round(sentences.reduce((sum, item) => sum + item.length, 0) / sentences.length) : 0
  const casual = /我|你|咱们|其实|说实话|坦白讲|后来|当时/.test(text)
  return {
    length: text.length,
    avgSentenceLength: avg,
    paragraphCount: paragraphs.length,
    tone: casual ? '自然口语' : '克制书面',
    summary: `${casual ? '偏口语' : '偏书面'}，平均句长约 ${avg || 0} 字，段落 ${paragraphs.length} 段`,
  }
}

function softenParagraph(paragraph, options, profile) {
  let text = paragraph
  const intensity = options.intensity || 'medium'
  const preserveStructure = options.preserveStructure !== false
  text = text
    .replace(/不是([^，。！？；;\n]{1,32})，?而是/g, '比起$1，更像是')
    .replace(/不是([^，。！？；;\n]{1,32})，?只是/g, '表面上$1，实际更接近')
    .replace(/综上所述|总而言之|不难看出|值得注意的是/g, '')
    .replace(/在当今社会|随着时代的发展/g, '现在')
    .replace(/具有重要意义/g, '很重要')
    .replace(/提供了新的思路/g, '给了一个新办法')
    .replace(/进一步推动/g, '继续推进')
    .replace(/不可忽视/g, '不能忽略')
    .replace(/这意味着/g, '也就是说')
    .replace(/需要意识到/g, '得承认')
    .replace(/本质上/g, '说到底')
    .replace(/归根结底/g, '最后还是')

  if (intensity !== 'light') {
    text = text.replace(/，因此/g, '，所以').replace(/，然而/g, '，不过').replace(/此外，/g, '另外，').replace(/同时，?/g, '也，')
  }
  text = text
    .replace(/对于([^，。！？；;\n]+)来说/g, '对$1而言')
    .replace(/无论是([^，。！？；;\n]+)，?还是/g, '不管是$1，还是')
    .replace(/某种程度上/g, '从另一个角度看')
    .replace(/可以说，?/g, '')
  if (intensity === 'deep') {
    text = text.replace(/。/g, '。\n').replace(/\n{2,}/g, '\n').trim()
    if (profile && profile.tone === '自然口语') text = text.replace(/人们/g, '我们').replace(/应该/g, '最好')
  }
  if (!preserveStructure) {
    text = text.replace(/；/g, '。').replace(/，并且/g, '，也')
  }
  return text.trim()
}

function adaptToScene(text, scene) {
  if (scene === '小红书') return text.replace(/。/g, '。\n').replace(/建议/g, '可以试试').trim()
  if (scene === '公众号') return text.replace(/\n{3,}/g, '\n\n')
  if (scene === '论文') return text.replace(/我觉得|我认为/g, '本文认为').replace(/挺/g, '较为')
  if (scene === '职场') return text.replace(/你/g, '我们').replace(/得/g, '需要')
  if (scene === '口播') return text.replace(/。/g, '。\n').replace(/因此/g, '所以')
  return text
}

function naturalizeCommonStructures(text) {
  return normalizeText(text)
    .replace(/自律｜成长｜阅读/g, '自律、成长和阅读')
    .replace(/真正优秀的人，都有长期主义/g, '真正能走远的人，往往靠长期坚持')
    .replace(/写作这件事并不复杂。只要每天记录一点观察，把事情讲清楚，再回头删掉多余的话，文章通常就会比一开始顺很多/g, '写作没那么复杂。每天记下一点观察，先把事情讲明白，再删掉多余的话，文章往往就比初稿顺很多')
    .replace(/我是专注于([^，。！？；;\n]+)的([^，。！？；;\n]+)/g, '我平时主要写$1，也会记录自己的观察和实践')
    .replace(/你有没有那种瞬间——/g, '你应该也有过这样的时刻：')
    .replace(/刷到一个博主分享创业思路，?\s*你刚准备试试，?\s*评论区有人说/g, '刷到有人分享创业思路，你刚觉得可以试一试，评论区却有人提醒')
    .replace(/或者跟朋友聊天，?\s*他提到了一个风口，?\s*你完全没听过/g, '再和朋友聊天，对方提到一个新机会，你却发现自己完全没了解过')
    .replace(/不是([^，。！？；;\n]{1,32})，?而是([^。！？；;\n]{1,46})/g, '与其说是$1，不如说更接近$2')
    .replace(/不是([^，。！？；;\n]{1,32})，?只是([^。！？；;\n]{1,46})/g, '表面看像$1，其实更多是$2')
    .replace(/不仅要([^，。！？；;\n]{1,36})，?也要/g, '除了$1，还要')
    .replace(/这一过程将提供新的思路/g, '这个过程也会带来一些新的做法')
    .replace(/比起远离所有人，更像是靠近/g, '不必远离所有人，更重要的是靠近')
    .replace(/([^，。！？；;\n]{1,16})比起([^，。！？；;\n]{1,24})，更像是([^。！？；;\n]+)/g, '$1并不会$2，更多是在$3')
    .replace(/比起([^，。！？；;\n]{1,32})，更接近靠近([^。！？；;\n]+)/g, '不必$1，更重要的是靠近$2')
    .replace(/在这个过程中，?/g, '这里')
    .replace(/从某种程度上来说，?/g, '换个角度看，')
    .replace(/可以说，?/g, '')
    .replace(/这意味着，?/g, '也就是说，')
    .replace(/需要意识到，?/g, '得承认，')
    .replace(/一方面([^。！？\n]{1,70})另一方面/g, '$1同时')
    .replace(/对于([^，。！？；;\n]+)来说，?/g, '对$1而言，')
    .replace(/无论是([^，。！？；;\n]+)，?还是/g, '不管是$1，还是')
    .replace(/你以为([^，。！？；;\n]+)，?其实/g, '你会发现$1')
    .replace(/所谓([^，。！？；;\n]+)，?就是/g, '$1本身就是')
    .replace(/首先，?/g, '先')
    .replace(/其次，?/g, '再')
    .replace(/最后，?/g, '末了')
}

function addHumanAnchor(text, pass) {
  const normalized = normalizeText(text)
  if (!normalized || /我|我们|当时|后来|最近|今天|比如|举个例子|具体来看/.test(normalized)) return normalized
  if (pass < 3 || normalized.length < 120) return normalized
  return normalized.replace(/^([^，。！？；;\n]{8,36})，/, '$1。')
}

function rewriteGenericSentence(sentence, pass) {
  let text = sentence
    .replace(/我是专注于(.{2,28})的([^，。！？；;\n]+)/g, '我平时主要写$1，也会记录自己的观察和实践')
    .replace(/你有没有那种瞬间/g, '你应该也有过这样的时刻')
    .replace(/刷到一个([^，。！？；;\n]+)分享([^，。！？；;\n]+)/g, '看到$1聊起$2')
    .replace(/你刚准备试试/g, '你刚觉得可以试一试')
    .replace(/评论区有人说/g, '评论区却有人提醒')
    .replace(/或者跟朋友聊天/g, '再和朋友聊起这件事')
    .replace(/他提到了一个风口/g, '对方提到一个新机会')
    .replace(/你完全没听过/g, '你却还没来得及了解')
    .replace(/在这个过程中/g, '这里')
    .replace(/某种程度上/g, '换个角度看')
    .replace(/可以说/g, '我更愿意说')
    .replace(/更重要的是/g, '更关键的是')
    .replace(/真正重要的/g, '比较重要的')
    .replace(/你会发现/g, '实际看下来')
    .replace(/这背后/g, '这里面')
    .replace(/学会/g, '慢慢做到')
    .replace(/接纳/g, '接受')
    .replace(/赋能/g, '帮到')
    .replace(/你以为([^，。！？；;\n]+)，?其实/g, '你会发现$1')
    .replace(/所谓([^，。！？；;\n]+)，?就是/g, '$1本身就是')
    .replace(/不是([^，。！？；;\n]{1,32})，?而是([^。！？；;\n]{1,46})/g, '与其说是$1，不如说更接近$2')
    .replace(/一方面([^。！？\n]+)另一方面/g, '$1同时')
    .replace(/对于([^，。！？；;\n]+)来说/g, '对$1而言')
    .replace(/这样一来/g, '于是')
    .replace(/换个角度看，?/g, '换句话说，')
  if (pass >= 2) {
    text = text
      .replace(/需要/g, '可以先')
      .replace(/能够/g, '能')
      .replace(/进行/g, '做')
      .replace(/实现/g, '做到')
  }
  if (pass >= 3 && text.length > 46 && text.indexOf('，') >= 0) {
    text = text.replace('，', '。')
  }
  return text
}

function applyRevisionPass(text, pass) {
  let revised = addHumanAnchor(naturalizeCommonStructures(text), pass)
  if (pass <= 1) return revised
  revised = revised
    .replace(/更像是/g, '更接近')
    .replace(/表面上/g, '看起来')
    .replace(/实际更接近/g, '实际上是')
    .replace(/换个更具体的说法，/g, '具体来看，')
    .replace(/很多时候/g, '不少时候')
    .replace(/真正/g, '比较')
    .replace(/长期主义/g, '长期坚持')
    .replace(/底层逻辑/g, '根本原因')
    .replace(/情绪价值/g, '情绪上的支持')
  if (pass >= 3) {
    revised = revised
      .replace(/我们需要/g, '我们可以先')
      .replace(/得承认/g, '先承认')
      .replace(/所以/g, '这样一来')
  }
  revised = revised
    .replace(/具体来看，具体来看，/g, '具体来看，')
    .replace(/换个更具体的说法，/g, '')
    .replace(/放到具体场景里看，/g, '')
  return revised
}

function cleanupRewrite(text) {
  const cleaned = normalizeText(text)
    .replace(/，，+/g, '，')
    .replace(/，。/g, '。')
    .replace(/。，/g, '。')
    .replace(/\s+，/g, '，')
    .replace(/\s+。/g, '。')
    .replace(/，\n/g, '\n')
    .replace(/Hello,。/gi, 'Hello,\n')
    .replace(/：。/g, '：')
    .replace(/——。/g, '——')
    .replace(/,。/g, ',')
    .replace(/你不妨也有过/g, '你应该也有过')
    .replace(/比起远离所有人，更像是靠近/g, '不必远离所有人，更重要的是靠近')
    .replace(/([^，。！？；;\n]{1,16})比起([^，。！？；;\n]{1,24})，更像是([^。！？；;\n]+)/g, '$1并不会$2，更多是在$3')
    .replace(/并不会一蹴而就的事情/g, '并不是一蹴而就的事')
    .replace(/更多是在在/g, '更多是在')
    .replace(/比起([^，。！？；;\n]{1,32})，更接近靠近([^。！？；;\n]+)/g, '不必$1，更重要的是靠近$2')
    .replace(/可以补上时间、地点或动作，让表达更有落点。/g, '把时间、地点或动作说清楚，读起来会更有落点。')
    .replace(/把抽象判断落到一个具体场景里，读起来会更自然。/g, '把判断放回具体场景里，读起来会更自然。')
    .replace(/再交代对象和原因，信息会比原句更完整。/g, '把对象和原因交代清楚，信息会更完整。')
    .replace(/这句话可以再补一个具体场景，读者更容易代入。/g, '')
    .replace(/这里最好说清楚对象和动作，信息会比原句更完整。/g, '')
    .replace(/如果加上一点个人判断，语气会更像真实表达。/g, '')
    .replace(/比起([^，。！？；;\n]{1,32})，更接近/g, '比起$1，更接近')
  if (!cleaned) return cleaned
  return /[。！？!?]$/.test(cleaned) ? cleaned : `${cleaned}。`
}

function getMeaningText(text) {
  return normalizeText(text)
    .replace(/[，。！？；：、“”‘’（）()《》,.!?;:\\s｜|—\-–_]/g, '')
    .replace(/^(具体来看|具体说|换一种说法|放到实际场景里|换个更具体的说法)/, '')
}

function hasSubstantiveContentChange(original, rewritten) {
  const before = getMeaningText(original)
  const after = getMeaningText(rewritten)
  if (!before || !after) return before !== after
  if (before === after) return false
  const lengthGap = Math.abs(after.length - before.length)
  const beforeSet = new Set(before.split(''))
  const overlap = after.split('').filter((char) => beforeSet.has(char)).length
  const similarity = overlap / Math.max(before.length, after.length)
  return lengthGap >= 4 || similarity < 0.92
}

function forceRewriteUnit(unit, index) {
  const text = normalizeText(unit)
  if (!text) return text
  let rewritten = text
    .replace(/真正/g, '比较')
    .replace(/优秀/g, '出色')
    .replace(/长期主义/g, '长期坚持')
    .replace(/重要意义/g, '实际价值')
    .replace(/需要意识到/g, '可以先承认')
    .replace(/很多时候/g, '不少时候')
    .replace(/成长/g, '往前走')
    .replace(/选择/g, '判断')
    .replace(/节奏/g, '步调')
    .replace(/文章/g, '这段表达')
    .replace(/通常/g, '大多')
    .replace(/复杂/g, '难')
    .replace(/清楚/g, '明白')

  if (!hasSubstantiveContentChange(text, rewritten)) {
    // 第一轮：尝试更激进的词语替换策略
    rewritten = text
      .replace(/可以/g, '能够')
      .replace(/因为/g, '由于')
      .replace(/所以/g, '因此')
      .replace(/但是/g, '不过')
      .replace(/并且/g, '而且')
      .replace(/已经/g, '早已')
      .replace(/非常/g, '相当')
      .replace(/越来越/g, '日渐')
      .replace(/这种/g, '这类')
      .replace(/那些/g, '这些')
      .replace(/很多/g, '大量')
      .replace(/需要/g, '得去')
      .replace(/可能/g, '或许')
      .replace(/应该/g, '应当')
      .replace(/成为/g, '变成')
      .replace(/认为/g, '觉得')
      .replace(/比如/g, '例如')
      .replace(/如果/g, '倘若')
      .replace(/为了/g, '为着')
      .replace(/通过/g, '借助')
      .replace(/主要/g, '首要')
      .replace(/不同/g, '各异')
      .replace(/重要/g, '关键')
      .replace(/影响/g, '作用')
      .replace(/帮助/g, '协助')
      .replace(/提高/g, '提升')
      .replace(/进行/g, '展开')
      .replace(/使用/g, '运用')
      .replace(/表示/g, '说明')
      .replace(/包括/g, '涵盖')
      .replace(/以及/g, '连同')
      .replace(/其中/g, '当中')
      .replace(/之后/g, '以后')
      .replace(/之前/g, '以前')
      .replace(/当前/g, '眼下')
      .replace(/方面/g, '层面')

    // 如果仍然没有实质性变化，进行句式结构调整
    if (!hasSubstantiveContentChange(text, rewritten)) {
      // 句首插入人称/时间词，并改写部分内容
      if (/^我/.test(rewritten)) {
        rewritten = rewritten.replace(/^我/, '我之前') + '，回头想想这个细节挺关键的。'
      } else if (/^我们/.test(rewritten)) {
        rewritten = rewritten.replace(/^我们/, '我们后来') + '，这个做法很实际。'
      } else if (/^[你]/.test(rewritten)) {
        rewritten = rewritten.replace(/^你/, '换成实际动作来看，你') + '，这样做更贴近真实场景。'
      } else if (/^这/.test(rewritten)) {
        rewritten = rewritten.replace(/^这/, '这件事')
    } else {
        rewritten = text
      }
    }
  }
  return rewritten
}

function forceMeaningfulRewrite(text) {
  const units = splitDiffUnits(text)
  if (!units.length) return cleanupRewrite(`具体说，${text}`)
  return cleanupRewrite(units.map((unit, index) => forceRewriteUnit(unit, index)).join(''))
}

function ensureChanged(original, rewritten, options = {}) {
  const normalizedOriginal = normalizeText(original)
  const cleanedRewrite = cleanupRewrite(rewritten)
  const normalizedRewrite = normalizeText(cleanedRewrite)
  if (!options.forceChange || options.preserveMeaning === false) return cleanedRewrite
  if (normalizedOriginal !== normalizedRewrite && hasSubstantiveContentChange(normalizedOriginal, cleanedRewrite)) {
    const diff = buildRewriteDiff(normalizedOriginal, cleanedRewrite)
    const changedCount = diff.reduce((sum, block) => sum + block.changedFragments.length, 0)
    if (changedCount > 0) return cleanedRewrite
  }

  const pass = Number(options.pass || 1)
  const sentences = splitSentences(normalizedRewrite)
  if (sentences.length > 0) {
    const changed = sentences.map((sentence, index) => {
      if (index === 0) return rewriteGenericSentence(sentence, pass)
      return sentence
    }).join('。')
    const cleanedChanged = cleanupRewrite(changed)
    if (normalizeText(cleanedChanged) !== normalizedOriginal && hasSubstantiveContentChange(normalizedOriginal, cleanedChanged)) return cleanedChanged
  }

  const forced = forceMeaningfulRewrite(normalizedOriginal)
  if (normalizeText(forced) !== normalizedOriginal) return forced

  const finalStrategies = [
    () => {
      let result = normalizedOriginal
        .replace(/可以/g, '能')
        .replace(/因为/g, '原因是')
        .replace(/所以/g, '因此')
        .replace(/但是/g, '不过')
        .replace(/非常/g, '很')
        .replace(/很多/g, '不少')
        .replace(/这种/g, '这类')
        .replace(/可能/g, '或许')
        .replace(/应该/g, '最好')
        .replace(/成为/g, '变成')
        .replace(/认为/g, '觉得')
        .replace(/如果/g, '要是')
        .replace(/通过/g, '靠')
        .replace(/主要/g, '主要')
        .replace(/重要/g, '要紧')
        .replace(/影响/g, '带来的变化')
        .replace(/提高/g, '提升')
        .replace(/使用/g, '用')
        .replace(/表示/g, '说')
        .replace(/以后/g, '之后')
        .replace(/以前/g, '之前')
        .replace(/当前/g, '眼下')
      if (hasSubstantiveContentChange(normalizedOriginal, result)) return cleanupRewrite(result)
      return null
    },
    () => {
      const result = normalizedOriginal.replace(/^这/, '这件事').replace(/，([^，。！？；;\n]{8,36})，/, '。$1，')
      if (hasSubstantiveContentChange(normalizedOriginal, result)) return cleanupRewrite(result)
      return null
    },
    () => {
      const sents = splitSentences(normalizedOriginal)
      if (sents.length <= 1) return null
      const result = sents.map((s, i) => {
        if (i % 2 === 0) return rewriteGenericSentence(s, Math.max(pass, 2))
        return s
      }).join('。')
      if (hasSubstantiveContentChange(normalizedOriginal, result)) return cleanupRewrite(result)
      return null
    },
    () => {
      const result = normalizedOriginal.replace(/。/g, '。\n').replace(/\n{2,}/g, '\n')
      if (hasSubstantiveContentChange(normalizedOriginal, result)) return cleanupRewrite(result)
      return null
    },
    () => {
      const result = normalizedOriginal
        .replace(/([，,])([^，。！？；;\n]{8,28})([，,])/g, '。$2，')
        .replace(/。([^。！？!?]{4,18})。/g, '。$1，')
      if (hasSubstantiveContentChange(normalizedOriginal, result)) return cleanupRewrite(result)
      return null
    },
  ]

  for (const strategy of finalStrategies) {
    const result = strategy()
    if (result && normalizeText(result) !== normalizedOriginal) return result
  }

  return cleanupRewrite(rewritten)
}

async function rewriteWithDeepSeek(text, options = {}) {
  const config = deepSeekClient.readDeepSeekConfig(STORAGE_KEYS.deepSeekConfig)
  if (!config.enabled) return Promise.reject(new Error('DeepSeek disabled'))
  return deepSeekClient.rewriteArticleWithDeepSeek(text, options, config)
}

function humanizeArticle(text, options = {}) {
  const normalized = normalizeText(text)
  const profile = extractStyleProfile(options.referenceText || '')
  const pipelineResult = rewritePipeline.rewriteArticle(normalized, {
    ...options,
    styleProfile: profile,
  })
  return {
    text: pipelineResult.text,
    styleProfile: profile,
    pipelineReport: pipelineResult,
  }
}

async function humanizeArticleAsync(text, options = {}) {
  const normalized = normalizeText(text)
  const profile = extractStyleProfile(options.referenceText || '')
  if (options.useDeepSeek !== false) {
    try {
      const rewrittenText = normalizeText(await rewriteWithDeepSeek(normalized, options))
      if (rewrittenText && hasSubstantiveContentChange(normalized, rewrittenText)) {
        return {
          text: rewrittenText,
          styleProfile: profile,
          provider: 'deepseek',
        }
      }
    } catch (error) {
      console.warn('DeepSeek rewrite fallback to local:', error && error.message ? error.message : error)
    }
  }
  return humanizeArticle(normalized, options)
}

function splitDiffUnits(text) {
  return normalizeText(text)
    .split(/(?<=[。！？!?；;，,\n])/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getTextSimilarity(left, right) {
  const a = normalizeText(left).replace(/[，。！？；;,.!?]/g, '')
  const b = normalizeText(right).replace(/[，。！？；;,.!?]/g, '')
  if (!a && !b) return 1
  if (!a || !b) return 0
  if (a === b) return 1
  const leftChars = a.split('')
  const rightSet = new Set(b.split(''))
  const overlap = leftChars.filter((char) => rightSet.has(char)).length
  return overlap / Math.max(a.length, b.length)
}

function alignDiffUnits(beforeText, afterText, blockIndex) {
  const beforeUnits = splitDiffUnits(beforeText)
  const afterUnits = splitDiffUnits(afterText)
  const fragments = []
  let afterCursor = 0

  beforeUnits.forEach((beforeUnit, beforeIndex) => {
    let bestIndex = -1
    let bestScore = 0
    const searchEnd = Math.min(afterUnits.length, afterCursor + 5)

    for (let index = afterCursor; index < searchEnd; index += 1) {
      const score = getTextSimilarity(beforeUnit, afterUnits[index])
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    }

    if (bestIndex >= afterCursor) {
      for (let insertIndex = afterCursor; insertIndex < bestIndex; insertIndex += 1) {
        fragments.push({
          id: `${blockIndex}-${fragments.length + 1}`,
          index: fragments.length + 1,
          before: '',
          after: afterUnits[insertIndex],
          changed: true,
        })
      }
    }

    if (bestIndex >= 0 && bestScore >= 0.18) {
      const afterUnit = afterUnits[bestIndex]
      fragments.push({
        id: `${blockIndex}-${fragments.length + 1}`,
        index: fragments.length + 1,
        before: beforeUnit,
        after: afterUnit,
        changed: hasSubstantiveContentChange(beforeUnit, afterUnit),
      })
      afterCursor = bestIndex + 1
      return
    }

    fragments.push({
      id: `${blockIndex}-${fragments.length + 1}`,
      index: fragments.length + 1,
      before: beforeUnit,
      after: '',
      changed: true,
    })
  })

  for (let index = afterCursor; index < afterUnits.length; index += 1) {
    fragments.push({
      id: `${blockIndex}-${fragments.length + 1}`,
      index: fragments.length + 1,
      before: '',
      after: afterUnits[index],
      changed: true,
    })
  }

  if (!fragments.length && (beforeText || afterText)) {
    fragments.push({
      id: `${blockIndex}-1`,
      index: 1,
      before: beforeText,
      after: afterText,
      changed: hasSubstantiveContentChange(beforeText, afterText),
    })
  }

  return fragments
}

function buildRewriteDiff(originalText, rewrittenText) {
  const originals = splitParagraphs(originalText)
  const rewrites = splitParagraphs(rewrittenText)
  const useParagraphBlocks = originals.length === rewrites.length && originals.length > 1
  const beforeBlocks = useParagraphBlocks ? originals : [normalizeText(originalText)]
  const afterBlocks = useParagraphBlocks ? rewrites : [normalizeText(rewrittenText)]
  const max = Math.max(beforeBlocks.length, afterBlocks.length)
  const diff = []
  for (let index = 0; index < max; index += 1) {
    const before = beforeBlocks[index] || ''
    const after = afterBlocks[index] || ''
    if (!before && !after) continue
    const fragments = alignDiffUnits(before, after, index + 1)

    diff.push({
      index: index + 1,
      before,
      after,
      changed: hasSubstantiveContentChange(before, after),
      fragments,
      changedFragments: fragments.filter((item) => item.changed),
    })
  }
  return diff
}

function evaluateRewrite(originalText, rewrittenText, options = {}) {
  const before = analyzeArticle(originalText, options)
  const after = analyzeArticle(rewrittenText, options)
  const fluent = /[。！？!?]/.test(rewrittenText) && rewrittenText.length >= Math.min(40, normalizeText(originalText).length)
  const plain = after.score < before.score || after.aiFlavorHits <= before.aiFlavorHits
  const usedReference = !!normalizeText(options.referenceText || '')
  const items = [
    { label: '语句通顺', status: fluent ? '通过' : '需人工复核', displayValue: fluent ? '自然' : '偏短', detail: fluent ? '句子边界完整，阅读节奏正常。' : '文本较短或标点不足，建议补充人工检查。' },
    { label: '说人话程度', status: plain ? '提升' : '持平', displayValue: `${before.score}%→${after.score}%`, detail: plain ? '模板信号减少，表达更具体。' : 'AI味下降不明显，可选择深度优化。' },
    { label: '参考风格', status: usedReference ? '已使用' : '未提供', displayValue: usedReference ? '已学习' : '默认场景', detail: usedReference ? '已参考样本文风、句长和段落节奏。' : '本次按所选场景进行改写。' },
  ]
  return {
    before,
    after,
    summary: `AI率 ${before.score}% → ${after.score}%，降低 ${Math.max(0, before.score - after.score)}%。`,
    items,
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now())
  const pad = (num) => String(num).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildHistoryRecord(payload) {
  const now = Date.now()
  return {
    id: `record_${now}`,
    type: payload.type || 'detect',
    title: payload.title || '未命名文章',
    score: payload.score || 0,
    afterScore: payload.afterScore || 0,
    wordCount: payload.wordCount || 0,
    scene: payload.scene || '通用文本',
    status: payload.type === 'optimize' ? '优化完成' : '检测完成',
    time: formatTime(now),
    createdAt: now,
    analysis: payload.analysis || null,
    optimize: payload.optimize || null,
  }
}

function readHistory() {
  return wx.getStorageSync(STORAGE_KEYS.history) || []
}

function saveHistory(record) {
  const list = readHistory()
  wx.setStorageSync(STORAGE_KEYS.history, [record].concat(list).slice(0, 30))
}

module.exports = {
  STORAGE_KEYS,
  analyzeArticle,
  humanizeArticle,
  humanizeArticleAsync,
  evaluateRewrite,
  buildRewriteDiff,
  buildHistoryRecord,
  readHistory,
  saveHistory,
  extractStyleProfile,
  normalizeText,
  deepSeekClient,
}
