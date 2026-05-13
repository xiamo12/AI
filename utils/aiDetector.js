/**
 * Local AI Text Detector v3.0
 * Ported from the Python detector so the mini program can run independently.
 *
 * v3.0 增强: 字符级 n-gram 特征, 句首多样性, 标点分布, 虚词密度, 段落均匀度
 */

const VERSION = '3.0.0-local'

const { clamp, normalizeText, splitSentences } = require('./util')

const FUNCTION_WORDS = new Set(
  '的了着过把被对于在在和与等跟从向沿着朝着按照凭靠根据关于由于为了除了比同跟和或及以及不但因为所以虽然但是如果然而而且因此'
)

function now() {
  return Date.now()
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value))
}

function splitClauses(text) {
  return normalizeText(text).split(/[，,。！？!?；;：:\n]+/).map((item) => item.trim()).filter(Boolean)
}

function tokenize(text) {
  const normalized = normalizeText(text).toLowerCase()
  const english = normalized.match(/[a-z0-9]+(?:['-][a-z0-9]+)?/g) || []
  const chinese = normalized.replace(/[a-z0-9\s，。！？；：、“”‘’（）()《》,.!?;:'"\-—_`~@#$%^&*+=/\\[\]{}<>|]/gi, '').split('')
  return english.concat(chinese).filter(Boolean)
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function variance(values) {
  if (values.length < 2) return 0
  const avg = mean(values)
  return mean(values.map((value) => Math.pow(value - avg, 2)))
}

function std(values) {
  return Math.sqrt(variance(values))
}

function entropy(tokens) {
  if (!tokens.length) return 0
  const counts = {}
  tokens.forEach((token) => { counts[token] = (counts[token] || 0) + 1 })
  return Object.keys(counts).reduce((sum, token) => {
    const p = counts[token] / tokens.length
    return sum - p * Math.log(p)
  }, 0)
}

function wordFrequencyVariance(tokens) {
  const counts = {}
  tokens.forEach((token) => { counts[token] = (counts[token] || 0) + 1 })
  return variance(Object.keys(counts).map((key) => counts[key]))
}

function lexicalDiversity(tokens) {
  if (!tokens.length) return 0
  return new Set(tokens).size / tokens.length
}

function computeZipfianScore(tokens) {
  if (tokens.length < 2) return 0
  const counts = {}
  tokens.forEach((token) => { counts[token] = (counts[token] || 0) + 1 })
  const sortedCounts = Object.keys(counts).map((key) => counts[key]).sort((a, b) => b - a)
  if (sortedCounts.length < 2) return 0

  const xs = sortedCounts.map((_, index) => Math.log(index + 1))
  const ys = sortedCounts.map((count) => Math.log(count + 1))
  const avgX = mean(xs)
  const avgY = mean(ys)
  const denominator = xs.reduce((sum, x) => sum + Math.pow(x - avgX, 2), 0) || 1
  const slope = xs.reduce((sum, x, index) => sum + (x - avgX) * (ys[index] - avgY), 0) / denominator
  const alpha = -slope
  const predictedRaw = sortedCounts.map((_, index) => 1 / Math.pow(index + 1, alpha || 1))
  const scale = tokens.length / (predictedRaw.reduce((sum, value) => sum + value, 0) || 1)
  const deviation = sortedCounts.reduce((sum, count, index) => {
    const expected = predictedRaw[index] * scale
    return sum + Math.pow(count - expected, 2) / (expected + 1e-6)
  }, 0)
  return deviation / sortedCounts.length
}

function sentenceComplexity(sentence) {
  const punct = (sentence.match(/[，,；;：:（）(){}[\]—-]/g) || []).length
  const length = Math.max(tokenize(sentence).length, 1)
  return punct / length
}

function cosineFromFrequency(leftTokens, rightTokens) {
  if (!leftTokens.length || !rightTokens.length) return 0
  const left = {}
  const right = {}
  leftTokens.forEach((token) => { left[token] = (left[token] || 0) + 1 })
  rightTokens.forEach((token) => { right[token] = (right[token] || 0) + 1 })
  const keys = new Set(Object.keys(left).concat(Object.keys(right)))
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  keys.forEach((key) => {
    const a = left[key] || 0
    const b = right[key] || 0
    dot += a * b
    leftNorm += a * a
    rightNorm += b * b
  })
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) || 1)
}

// ============================================================
// v3.0 新增特征函数
// ============================================================

/**
 * 字符级 n-gram 特征：
 * - trigram TTR (类型-标记比): 唯一 trigram 数 / trigram 总数。AI 文本偏低(重复多)
 * - trigram 熵: 字符 trigram 分布的香农熵。AI 文本偏低(更可预测)
 * - 重复率: 出现超过一次的 trigram 占比。AI 文本偏高
 * - quadgram TTR: 4-gram 类型标记比。比 trigram 更敏感
 */
function computeNgramFeatures(text) {
  const cleaned = text.replace(/\s/g, '')
  const len = cleaned.length

  // Trigram 特征
  const trigramCounts = {}
  for (let i = 0; i <= len - 3; i++) {
    const tri = cleaned.substring(i, i + 3)
    trigramCounts[tri] = (trigramCounts[tri] || 0) + 1
  }
  const trigramTotal = Object.values(trigramCounts).reduce((a, b) => a + b, 0)
  const trigramUnique = Object.keys(trigramCounts).length
  const trigramTTR = trigramTotal > 0 ? trigramUnique / trigramTotal : 1

  // Trigram 熵
  let trigramEntropy = 0
  if (trigramTotal > 0) {
    trigramEntropy = -Object.values(trigramCounts).reduce((sum, count) => {
      const p = count / trigramTotal
      return sum + p * Math.log(p + 1e-10)
    }, 0)
  }

  // 重复率: 出现过 2+ 次的 trigram 占总 trigram 数的比例
  let repeatTotal = 0
  Object.values(trigramCounts).forEach((count) => {
    if (count > 1) repeatTotal += count
  })
  const repeatRatio = trigramTotal > 0 ? repeatTotal / trigramTotal : 0

  // Quadgram TTR
  const quadgramCounts = {}
  for (let i = 0; i <= len - 4; i++) {
    const quad = cleaned.substring(i, i + 4)
    quadgramCounts[quad] = (quadgramCounts[quad] || 0) + 1
  }
  const quadTotal = Object.values(quadgramCounts).reduce((a, b) => a + b, 0)
  const quadUnique = Object.keys(quadgramCounts).length
  const quadgramTTR = quadTotal > 0 ? quadUnique / quadTotal : 1

  return {
    trigramTTR,
    trigramEntropy,
    repeatRatio,
    quadgramTTR,
  }
}

/**
 * 句首多样性:
 * 计算所有句子前2-4字的去重比例。人类写作句首更多样，AI更趋同。
 * 返回 [0,1], 越低 → 更像 AI
 */
function computeSentenceInitialDiversity(sentences) {
  if (sentences.length < 4) return 1
  const starters = sentences
    .map((s) => {
      const cleaned = s.trim().replace(/^[「『""''（(【\[《,，、。！？!?]/, '').replace(/[。！？!?；;]$/, '')
      return cleaned.slice(0, 3)
    })
    .filter((s) => s.length >= 2)
  if (starters.length < 3) return 1
  return new Set(starters).size / starters.length
}

/**
 * 标点分布指纹:
 * AI 文本在标点使用上有可量化的差异特征。
 * 返回 { commaRatio, diversity, complexity, ... }
 */
function computePunctuationProfile(text) {
  const stats = {
    comma: (text.match(/[，,]/g) || []).length,
    period: (text.match(/[。]/g) || []).length,
    excl: (text.match(/[！!]/g) || []).length,
    quest: (text.match(/[？?]/g) || []).length,
    colon: (text.match(/[：:]/g) || []).length,
    semicolon: (text.match(/[；;]/g) || []).length,
    ellipsis: (text.match(/…{2,}\.{3,}/g) || text.match(/…/g) || []).length,
    dash: (text.match(/[—–-]{2,}/g) || []).length,
    quote: (text.match(/[""'']/g) || []).length,
    paren: (text.match(/[（）()]/g) || []).length,
  }

  const total = Object.values(stats).reduce((a, b) => a + b, 0) || 1

  // AI 文本逗号/句号比偏高, 少用省略号/破折号
  const commaPeriodRatio = (stats.comma + 1) / (stats.period + 1)
  const ellipsisRatio = stats.ellipsis / total
  const dashRatio = stats.dash / total

  // 去重标点(带/不带)的熵 → AI 文本标点分布更单调
  const punctValues = Object.values(stats).filter((v) => v > 0)
  const punctEntropy = punctValues.length > 1
    ? -punctValues.reduce((sum, count) => {
        const p = count / total
        return sum + p * Math.log(p)
      }, 0)
    : 0

  // 逗号占比: AI 倾向用更多逗号连接从句
  const commaShare = stats.comma / total

  return {
    commaPeriodRatio: Math.min(commaPeriodRatio / 8, 1),
    ellipsisScore: 1 / (1 + ellipsisRatio * 50),
    dashScore: 1 / (1 + dashRatio * 50),
    punctEntropy,
    commaShare: Math.min(commaShare * 1.5, 1),
  }
}

/**
 * 虚词密度: 中文虚词(的、了、着、过、把、被等)在全文中的占比。
 * AI 文本的虚词分布特征与人类不同。
 */
function computeFunctionWordFeatures(text) {
  const cleaned = text.replace(/\s/g, '')
  if (!cleaned.length) return { density: 0, diversity: 0 }
  const chars = cleaned.split('')
  const fwChars = chars.filter((c) => FUNCTION_WORDS.has(c))
  const density = fwChars.length / chars.length

  // 虚词类型多样性: 使用不同虚词的数量 / 总虚词数
  const fwSet = new Set(fwChars)
  const diversity = fwChars.length > 0 ? fwSet.size / Math.min(fwChars.length, fwSet.size * 3) : 0

  return { density, diversity }
}

/**
 * 段落均匀度 (变异系数):
 * 将文本分为等长段落/窗口, 计算各段特征的变异系数。
 * AI 文本在全文范围内更均匀 → 变异系数偏低。
 */
function computeUniformity(text) {
  const cleaned = text.replace(/\s/g, '')
  if (cleaned.length < 60) return 1

  // 将文本分为 4-6 个窗口
  const windowCount = Math.min(6, Math.max(4, Math.floor(cleaned.length / 40)))
  const windowSize = Math.ceil(cleaned.length / windowCount)
  const windowEntropies = []

  for (let w = 0; w < windowCount; w++) {
    const start = w * windowSize
    const end = Math.min(start + windowSize, cleaned.length)
    const window = cleaned.slice(start, end)

    // 计算每个窗口的字符级 2-gram 熵
    const bigramCounts = {}
    const wLen = window.length
    for (let i = 0; i <= wLen - 2; i++) {
      const bg = window.substring(i, i + 2)
      bigramCounts[bg] = (bigramCounts[bg] || 0) + 1
    }
    const bgTotal = Object.values(bigramCounts).reduce((a, b) => a + b, 0)
    let bgEntropy = 0
    if (bgTotal > 0) {
      bgEntropy = -Object.values(bigramCounts).reduce((sum, count) => {
        const p = count / bgTotal
        return sum + p * Math.log(p + 1e-10)
      }, 0)
    }
    windowEntropies.push(bgEntropy)
  }

  // 变异系数 = std / mean
  const windowMean = mean(windowEntropies)
  if (windowMean === 0) return 1
  const windowStd = std(windowEntropies)
  const cv = windowStd / windowMean

  return Math.min(cv * 3, 1) // 越高 → 越不均匀 → 越像人类
}

function buildSimilarityStats(sentences) {
  const tokenized = sentences.map(tokenize)
  const pairScores = []
  const consecutive = []
  for (let left = 0; left < tokenized.length; left += 1) {
    for (let right = left + 1; right < tokenized.length; right += 1) {
      const score = cosineFromFrequency(tokenized[left], tokenized[right])
      pairScores.push(score)
      if (right === left + 1) consecutive.push(score)
    }
  }
  const flatRegions = []
  let start = null
  consecutive.forEach((score, index) => {
    if (score > 0.62) {
      if (start === null) start = index
    } else if (start !== null) {
      flatRegions.push([start, index])
      start = null
    }
  })
  if (start !== null) flatRegions.push([start, consecutive.length])

  const meanSimilarity = mean(pairScores)
  const stdSimilarity = std(pairScores)
  const smoothness = consecutive.length ? 1 / (1 + std(consecutive)) : 0
  const diversity = pairScores.length ? 1 - meanSimilarity : 0
  const clustering = pairScores.length ? pairScores.filter((score) => score > 0.48).length / pairScores.length : 0

  return {
    meanSimilarity,
    stdSimilarity,
    smoothness,
    diversity,
    clustering,
    flatRegions,
  }
}

function computeStatisticalFeatures(text, sentences) {
  const sentenceTokens = sentences.map(tokenize)
  const entropies = sentenceTokens.map(entropy)
  const allTokens = tokenize(text)
  const sentenceLengths = sentenceTokens.map((tokens, index) => tokens.length || sentences[index].length)
  const complexities = sentences.map(sentenceComplexity)

  // v3.0 新增特征 ============================================
  const ngram = computeNgramFeatures(text)
  const initialDiversity = computeSentenceInitialDiversity(sentences)
  const punct = computePunctuationProfile(text)
  const funcWord = computeFunctionWordFeatures(text)
  const uniformity = computeUniformity(text)

  return {
    // 原有特征
    entropyMean: mean(entropies),
    entropyVariance: variance(entropies),
    burstiness: Math.sqrt(Math.pow(std(sentenceLengths), 2) + Math.pow(std(complexities), 2)),
    zipfianScore: computeZipfianScore(allTokens),
    perplexityEstimate: allTokens.length ? -Math.log(lexicalDiversity(allTokens) + 1e-6) : 0,
    wordFreqVariance: wordFrequencyVariance(allTokens),
    lexicalDiversity: lexicalDiversity(allTokens),
    sentenceLengths,
    complexities,
    allTokens,

    // v3.0 新增
    trigramTTR: ngram.trigramTTR,
    trigramEntropy: ngram.trigramEntropy,
    repeatRatio: ngram.repeatRatio,
    quadgramTTR: ngram.quadgramTTR,
    sentenceInitialDiversity: initialDiversity,
    punctCommaRatio: punct.commaPeriodRatio,
    punctEllipsisScore: punct.ellipsisScore,
    punctDashScore: punct.dashScore,
    punctEntropy: punct.punctEntropy,
    punctCommaShare: punct.commaShare,
    funcWordDensity: funcWord.density,
    funcWordDiversity: funcWord.diversity,
    uniformityCV: uniformity,
  }
}

function computeStatisticalScore(features) {
  // 原有特征分
  const entropyVarScore = 1 / (1 + features.entropyVariance)
  const burstinessScore = 1 / (1 + features.burstiness / 18)
  const zipfianScore = 1 / (1 + features.zipfianScore / 18)
  const perplexityScore = sigmoid(features.perplexityEstimate - 0.7)
  const freqVarScore = 1 / (1 + features.wordFreqVariance)
  const lexDiversityScore = clamp(features.lexicalDiversity * 1.15, 0, 1)

  // v3.0 新增特征分 ==========================================
  // n-gram TTR: 越低 → AI 特征越强 → 异常分越高
  const triTTROnAnomaly = 1 - clamp(features.trigramTTR * 1.1, 0, 0.95)
  const quadTTROnAnomaly = 1 - clamp(features.quadgramTTR * 1.1, 0, 0.95)
  // 重复率: 越高 → AI 特征越强
  const repeatScore = sigmoid((features.repeatRatio - 0.15) * 5)
  // 句首多样性: 越低 → AI
  const initDivAnomaly = 1 - clamp(features.sentenceInitialDiversity, 0, 1)
  // 标点: 逗号占比接近中间值(0.25-0.35)反而是人类, 两头异常
  const commaAnomaly = features.punctCommaShare > 0.55
    ? sigmoid((features.punctCommaShare - 0.4) * 4)
    : 0
  // 标点熵: 偏低 = 标点单调 = AI
  const punctEntropyAnomaly = features.punctEntropy > 0
    ? 1 - sigmoid((features.punctEntropy - 0.8) * 2)
    : 0.5
  // 虚词密度: AI 文本密度波动范围较窄
  const funcWordAnomaly = features.funcWordDensity > 0.12
    ? Math.min((features.funcWordDensity - 0.08) / 0.15, 1)
    : 0
  // 段落均匀度: 越低 → 越均匀 → AI
  const uniformityAnomaly = 1 - sigmoid((features.uniformityCV - 0.15) * 4)

  // 加权融合 - 权重分配基于各特征的已知判别力
  // v3.1: 降低 n-gram/虚词等易误判特征权重, 回归核心统计特征
  const featureWeights = {
    // 核心统计特征 (提升权重)
    entropyVar: 0.12,
    burstiness: 0.14,
    zipfian: 0.07,
    perplexity: 0.05,
    freqVar: 0.05,
    lexDiversity: 0.12,
    // n-gram 特征 (大幅降权 — 易对高质量中文文本误判)
    triTTR: 0.04,
    quadTTR: 0.02,
    repeatRatio: 0.03,
    // 辅助特征 (适度降权)
    initDiversity: 0.04,
    commaProfile: 0.02,
    punctEntropy: 0.02,
    funcWord: 0.02,
    uniformity: 0.03,
  }

  let weightedSum = 0
  let totalWeight = 0

  const contributions = {
    entropyVar: entropyVarScore,
    burstiness: burstinessScore,
    zipfian: zipfianScore,
    perplexity: perplexityScore,
    freqVar: freqVarScore,
    lexDiversity: lexDiversityScore,
    triTTR: triTTROnAnomaly,
    quadTTR: quadTTROnAnomaly,
    repeatRatio: repeatScore,
    initDiversity: initDivAnomaly,
    commaProfile: commaAnomaly,
    punctEntropy: punctEntropyAnomaly,
    funcWord: funcWordAnomaly,
    uniformity: uniformityAnomaly,
  }

  for (const [key, weight] of Object.entries(featureWeights)) {
    weightedSum += (contributions[key] || 0) * weight
    totalWeight += weight
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0.5
  return clamp(score, 0, 1)
}

function computeSemanticScore(features) {
  const similarityScore = sigmoid(features.meanSimilarity * 4 - 1.1)
  const smoothnessScore = features.smoothness
  const flatScore = Math.min(features.flatRegions.length / 3, 1)

  // v3.0: flat region 加权 - 区域越长, 分值越高
  let weightedFlatScore = flatScore
  if (features.flatRegions.length > 0) {
    const maxRegionLen = Math.max(...features.flatRegions.map((r) => r[1] - r[0]))
    const lenFactor = Math.min(maxRegionLen / 5, 1)
    weightedFlatScore = clamp(flatScore * (1 + lenFactor * 0.3), 0, 1)
  }

  const diversityScore = 1 - clamp(features.diversity, 0, 1)

  const score = (
    0.15 * similarityScore +
    0.15 * smoothnessScore +
    0.12 * weightedFlatScore +
    0.04 * diversityScore +
    0.04 * features.clustering
  ) / 0.50

  return clamp(score, 0, 1)
}

function computeConfidence(scores) {
  const scoreVariance = variance(scores)
  const baseConfidence = clamp(1 / (1 + scoreVariance * 4), 0, 1)

  // v3.0: 分数较高或较低时置信度增加(远离0.5边界)
  const meanScore = mean(scores)
  const distanceFromHalf = Math.abs(meanScore - 0.5) * 2 // [0, 1]
  const confidenceBoost = distanceFromHalf * 0.15

  return clamp(baseConfidence + confidenceBoost, 0, 1)
}

function computeConfidenceInterval(score, confidence) {
  const uncertainty = 4 * score * (1 - score)
  const standardError = Math.sqrt(Math.max(uncertainty, 0)) * (1 - confidence)
  const margin = 1.96 * standardError
  return {
    lower: clamp(score - margin, 0, 1),
    upper: clamp(score + margin, 0, 1),
  }
}

function getRiskTypesForSentence(sentence, index, stat, semantic) {
  const riskTypes = []
  const tokens = tokenize(sentence)
  const sentenceEntropy = entropy(tokens)
  const inFlatRegion = semantic.flatRegions.some((range) => range[0] <= index && index <= range[1])
  if (inFlatRegion) riskTypes.push('flat_logic')
  if (sentenceEntropy < Math.max(1.3, stat.entropyMean * 0.55)) riskTypes.push('low_entropy')
  if (tokens.length < 8 && sentence.length > 0) riskTypes.push('short_sentence')
  if (sentence.length > 54) riskTypes.push('long_template_sentence')
  if (/不是[^。！？；;\n]{1,46}而是|一方面[^。！？\n]{1,70}另一方面|综上所述|总而言之|值得注意的是/.test(sentence)) {
    riskTypes.push('template_pattern')
  }

  // v3.0: 新增风险类型
  // 句子开头重复
  if (sentence.trim().length > 8 && /^(其实|然而|因此|所以|但是|不过|同时|此外)[，,]/.test(sentence.trim())) {
    riskTypes.push('generic_opener')
  }
  // 缺少具体名词的纯抽象句
  const cleaned = sentence.replace(/[，。！？；：、""''（）()《》,.!?;:'"]/g, '')
  if (cleaned.length > 15 && !/[\d]/.test(cleaned) && !/我|你|我们|这|那|书|读|写|做|看|朋友|同事|家里|公司/.test(cleaned)) {
    riskTypes.push('abstract_only')
  }

  return riskTypes
}

function generateHeatmap(sentences, stat, semantic) {
  return sentences.map((sentence, index) => {
    const riskTypes = getRiskTypesForSentence(sentence, index, stat, semantic)
    const lengthScore = sentence.length > 54 ? 0.18 : sentence.length < 12 ? 0.08 : 0
    const entropyScore = riskTypes.indexOf('low_entropy') >= 0 ? 0.20 : 0
    const flatScore = riskTypes.indexOf('flat_logic') >= 0 ? 0.28 : 0
    const templateScore = riskTypes.indexOf('template_pattern') >= 0 ? 0.32 : 0

    // v3.0 新增风险权重
    const genericOpenerScore = riskTypes.indexOf('generic_opener') >= 0 ? 0.12 : 0
    const abstractScore = riskTypes.indexOf('abstract_only') >= 0 ? 0.14 : 0

    const riskScore = clamp(
      lengthScore + entropyScore + flatScore + templateScore + genericOpenerScore + abstractScore,
      0, 1
    )
    return {
      segment_idx: index,
      text: sentence.length > 100 ? `${sentence.slice(0, 100)}...` : sentence,
      risk_score: Number(riskScore.toFixed(4)),
      risk_types: riskTypes,
      sentence_length: tokenize(sentence).length,
      confidence: Number((1 - riskScore * 0.3).toFixed(4)),
    }
  }).filter((item) => item.risk_score > 0.1)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 20)
}

function detectLocal(text, options = {}) {
  const started = now()
  const normalized = normalizeText(text)
  const threshold = typeof options.threshold === 'number' ? options.threshold : 0.5
  if (!normalized) {
    return {
      success: true,
      overall_ai_score: 0,
      confidence: 0,
      is_ai_generated: false,
      confidence_interval: { lower: 0, upper: 0 },
      processing_time_ms: now() - started,
      heatmap_data: [],
      metadata: { error: 'Invalid or empty text input', n_sentences: 0, n_clauses: 0 },
    }
  }

  const sentences = splitSentences(normalized)
  const clauses = splitClauses(normalized)
  const stat = computeStatisticalFeatures(normalized, sentences)
  const semantic = buildSimilarityStats(sentences)
  const statScore = computeStatisticalScore(stat)
  const semanticScore = computeSemanticScore(semantic)

  // 对于极短文本（<=2句），语义相似度计算不可靠（无法做有意义的成对比较），
  // 此时以统计特征为主，大幅降低语义分数权重
  let overall
  if (sentences.length <= 2) {
    overall = (statScore * 0.82 + semanticScore * 0.18) * 0.82
  } else {
    overall = (statScore + semanticScore) / 2
  }

  // 人类信号修正 — 用词匹配而非字符集，避免"后"="尝试后"等误命中
  if (/(?:说实话|坦白讲|我记得|我遇到|我见过|我感觉|我觉得|我曾经|我平时|我当时|有次|有一次|那天|后来|当时|最近|今天|举个例子|具体来看)/.test(normalized)) overall -= 0.05

  // AI 信号修正
  if (/(综上所述|总而言之|值得注意的是|不是[^。！？；;\n]{1,46}而是|一方面[^。！？\n]{1,70}另一方面)/.test(normalized)) overall += 0.08

  // v3.0: 多检测器一致性的自动校准
  // 如果 statScore 和 semanticScore 分歧大 → 降低整体置信度 → 轻微拉回
  const detectorDisagreement = Math.abs(statScore - semanticScore)
  if (detectorDisagreement > 0.25) {
    overall = overall * 0.95 + 0.5 * 0.05 // 向 0.5 轻微收缩
  }

  overall = clamp(overall, 0, 1)

  const confidence = computeConfidence([statScore, semanticScore, overall])
  const confidenceInterval = computeConfidenceInterval(overall, confidence)
  const heatmapData = options.include_heatmap === false ? [] : generateHeatmap(sentences, stat, semantic)

  return {
    success: true,
    overall_ai_score: Number(overall.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    is_ai_generated: overall > threshold,
    confidence_interval: {
      lower: Number(confidenceInterval.lower.toFixed(4)),
      upper: Number(confidenceInterval.upper.toFixed(4)),
    },
    processing_time_ms: now() - started,
    from_cache: false,
    heatmap_data: heatmapData,
    metadata: {
      detector: 'local-js-ensemble',
      version: VERSION,
      n_sentences: sentences.length,
      n_clauses: clauses.length,
      text_length: normalized.length,
      avg_sentence_length: mean(stat.sentenceLengths),
      statistical_features: {
        entropy_mean: stat.entropyMean,
        entropy_variance: stat.entropyVariance,
        burstiness: stat.burstiness,
        zipfian_score: stat.zipfianScore,
        perplexity_estimate: stat.perplexityEstimate,
        word_freq_variance: stat.wordFreqVariance,
        lexical_diversity: stat.lexicalDiversity,
        // v3.0 新特征
        trigram_ttr: stat.trigramTTR,
        quadgram_ttr: stat.quadgramTTR,
        repeat_ratio: stat.repeatRatio,
        sentence_initial_diversity: stat.sentenceInitialDiversity,
        func_word_density: stat.funcWordDensity,
        uniformity_cv: stat.uniformityCV,
      },
      deep_learning_features: {
        mean_coherence: semantic.meanSimilarity,
        coherence_std: semantic.stdSimilarity,
        transition_smoothness: semantic.smoothness,
        semantic_diversity: semantic.diversity,
        clustering_coefficient: semantic.clustering,
        flat_regions_detected: semantic.flatRegions.length,
        coherence_stats: {
          mean_similarity: semantic.meanSimilarity,
          std_similarity: semantic.stdSimilarity,
        },
      },
      roberta_score: null,
      component_scores: {
        statistical: statScore,
        semantic: semanticScore,
      },
      // v3.0: 添加子检测器分歧度（可用来判断结果可靠性）
      detector_agreement: 1 - detectorDisagreement,
    },
  }
}

function asyncReturn(work, onSuccess, onError) {
  try {
    const result = work()
    if (onSuccess) setTimeout(() => onSuccess(result), 0)
  } catch (error) {
    if (onError) {
      setTimeout(() => onError({ success: false, error: error.message || '检测失败' }), 0)
    }
  }
}

function detect(text, onSuccess, onError, options = {}) {
  if (!text || String(text).trim().length === 0) {
    if (onError) onError({ success: false, error: '文本不能为空' })
    return
  }
  asyncReturn(() => detectLocal(text, options), onSuccess, onError)
}

function batchDetect(texts, onSuccess, onError, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    if (onError) onError({ success: false, error: '文本数组不能为空' })
    return
  }
  if (texts.length > 100) {
    if (onError) onError({ success: false, error: '单次最多100个文本' })
    return
  }
  asyncReturn(() => {
    const started = now()
    const results = texts
      .filter((item) => item && String(item).trim())
      .map((item) => detectLocal(item, { ...options, include_heatmap: options.include_heatmap === true }))
    return {
      success: true,
      results,
      total_processing_time_ms: now() - started,
      count: results.length,
    }
  }, onSuccess, onError)
}

function getConfig(onSuccess) {
  if (onSuccess) {
    onSuccess({
      mode: 'local',
      version: VERSION,
      max_text_length: 50000,
      batch_size: 100,
      use_roberta: false,
      device: 'mini-program',
    })
  }
}

function getCacheStats(onSuccess) {
  if (onSuccess) onSuccess({ mode: 'local', cache_entries: 0, max_cache_size: 0 })
}

function clearCache(onSuccess) {
  if (onSuccess) onSuccess({ success: true, message: '本地检测无需缓存清理' })
}

function healthCheck(onSuccess) {
  if (onSuccess) {
    onSuccess({
      status: 'healthy',
      service: 'Local AI Text Detector',
      version: VERSION,
      timestamp: Date.now(),
    })
  }
}

function setAPIURL() {
  return false
}

function getAPIURL() {
  return 'local://ai-text-detector'
}

function detectAsync(text, options = {}) {
  return Promise.resolve(detectLocal(text, options))
}

function batchDetectAsync(texts, options = {}) {
  return Promise.resolve({
    success: true,
    results: texts.map((text) => detectLocal(text, options)),
  })
}

module.exports = {
  detect,
  batchDetect,
  getConfig,
  getCacheStats,
  clearCache,
  healthCheck,
  setAPIURL,
  getAPIURL,
  detectAsync,
  batchDetectAsync,
  detectLocal,
  normalizeText,
  splitSentences,
}
