/**
 * Local AI Text Detector
 * Ported from the Python detector so the mini program can run independently.
 */

const VERSION = '2.0.0-local'

function now() {
  return Date.now()
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value))
}

function normalizeText(text) {
  return String(text || '')
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitSentences(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []
  const matches = normalized.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [normalized]
  return matches.map((item) => item.trim()).filter(Boolean)
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
  return {
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
  }
}

function computeStatisticalScore(features) {
  const entropyVarScore = 1 / (1 + features.entropyVariance)
  const burstinessScore = 1 / (1 + features.burstiness / 18)
  const zipfianScore = 1 / (1 + features.zipfianScore / 18)
  const perplexityScore = sigmoid(features.perplexityEstimate - 0.7)
  const freqVarScore = 1 / (1 + features.wordFreqVariance)
  const lexDiversityScore = clamp(features.lexicalDiversity * 1.15, 0, 1)
  const score = (
    0.15 * entropyVarScore +
    0.10 * burstinessScore +
    0.10 * zipfianScore +
    0.05 * perplexityScore +
    0.05 * freqVarScore +
    0.10 * lexDiversityScore
  ) / 0.55
  return clamp(score, 0, 1)
}

function computeSemanticScore(features) {
  const similarityScore = sigmoid(features.meanSimilarity * 4 - 1.1)
  const smoothnessScore = features.smoothness
  const flatScore = Math.min(features.flatRegions.length / 3, 1)
  const diversityScore = 1 - clamp(features.diversity, 0, 1)
  const score = (
    0.15 * similarityScore +
    0.15 * smoothnessScore +
    0.10 * flatScore +
    0.05 * diversityScore +
    0.05 * features.clustering
  ) / 0.50
  return clamp(score, 0, 1)
}

function computeConfidence(scores) {
  const scoreVariance = variance(scores)
  return clamp(1 / (1 + scoreVariance * 4), 0, 1)
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
  return riskTypes
}

function generateHeatmap(sentences, stat, semantic) {
  return sentences.map((sentence, index) => {
    const riskTypes = getRiskTypesForSentence(sentence, index, stat, semantic)
    const lengthScore = sentence.length > 54 ? 0.18 : sentence.length < 12 ? 0.08 : 0
    const entropyScore = riskTypes.indexOf('low_entropy') >= 0 ? 0.20 : 0
    const flatScore = riskTypes.indexOf('flat_logic') >= 0 ? 0.28 : 0
    const templateScore = riskTypes.indexOf('template_pattern') >= 0 ? 0.32 : 0
    const riskScore = clamp(lengthScore + entropyScore + flatScore + templateScore, 0, 1)
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
  const scores = [statScore, semanticScore]
  let overall = mean(scores)

  if (sentences.length < 3) overall = overall * 0.82
  if (/[我我们当时后来最近今天说实话坦白讲]/.test(normalized)) overall -= 0.05
  if (/(综上所述|总而言之|值得注意的是|不是[^。！？；;\n]{1,46}而是|一方面[^。！？\n]{1,70}另一方面)/.test(normalized)) overall += 0.08
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
