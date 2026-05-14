/**
 * 语义级 AI 检测 v1.0
 * 纯 JS 实现，零外部依赖
 * 
 * 原理：
 * 1. 困惑度（Perplexity）：基于字符级 4-gram 语言模型
 *    使用通用中文语料预计算的 n-gram 频率表
 *    AI 文本困惑度偏低（用词更可预测），人类文本偏高
 * 
 * 2. 语义过渡平滑度（Transition Smoothness）：
 *    相邻句子间的词汇重叠和句式重复
 *    AI 文本句间过渡过于平滑
 * 
 * 3. 词汇多样性曲线（Lexical Variety Curve）：
 *    文章前半段 vs 后半段的 TTR 变化
 *    AI 文本从头到尾词汇多样性几乎不变
 */

const { normalizeText, splitSentences } = require('./util')

// ============================================================
// 第一部分：n-gram 语言模型（基于通用中文语料统计）
// ============================================================
//
// 这些频率表来自通用现代中文语料（新闻、文学、博客混合）
// 格式：ngram -> 出现次数（归一化后）
// 实际使用时我们会动态构建基于输入文本本身的模型，
// 然后比较"这个文本的 n-gram 分布有多大程度是统计上可预测的"
//
// 核心思想：不需要外部语料，用文本自身的统计结构来分析。
// AI 文本的 n-gram 重复模式高度可控且有规律的衰减，
// 人类文本的 n-gram 分布更"粗糙"——有些 ngram 异常高频，
// 有些异常低频，服从齐夫定律却不完全拟合。

/**
 * 计算句子粒度的字符级困惑度
 * 基于文本内部的 4-gram 模型
 * 
 * 算法：对每个句子，用文本其余部分的 n-gram 统计来估计概率
 * 如果句子可被文本自身很好地预测 → 低困惑度 → AI 特征
 * 如果句子在文本自身中也很"意外" → 高困惑度 → 人类特征
 */
function computePerplexity(text) {
  const sentences = splitSentences(text)
  if (sentences.length < 4) return { score: 0.5, details: '文本太短，困惑度分析不可靠' }
  
  const normalized = normalizeText(text).replace(/\s/g, '')
  
  // 构建全文的 4-gram 频率表
  const quadgrams = {}
  for (let i = 0; i <= normalized.length - 4; i++) {
    const q = normalized.substring(i, i + 4)
    quadgrams[q] = (quadgrams[q] || 0) + 1
  }
  const totalQuadgrams = Object.values(quadgrams).reduce((a, b) => a + b, 0)
  
  // 对每个句子计算困惑度
  const perSentencePPL = sentences.map(sentence => {
    const clean = sentence.replace(/\s/g, '')
    if (clean.length < 5) return null
    
    let logProbSum = 0
    let count = 0
    
    for (let i = 0; i <= clean.length - 4; i++) {
      const q = clean.substring(i, i + 4)
      const freq = quadgrams[q] || 0
      // 使用加一平滑
      const prob = (freq + 1) / (totalQuadgrams + Math.pow(4, 4))
      logProbSum += Math.log(prob)
      count++
    }
    
    if (count === 0) return null
    // PPL = exp(-1/N * sum(log P))
    const avgLogProb = logProbSum / count
    return Math.exp(-avgLogProb)
  }).filter(p => p !== null)
  
  if (perSentencePPL.length < 3) return { score: 0.5, details: '有效句子太少' }
  
  // AI 文本特征：
  // 1. 平均困惑度偏低（句子间自己"互相印证"的概率高）
  // 2. 困惑度方差小（所有句子的可预测性一致）
  const avgPPL = perSentencePPL.reduce((a, b) => a + b, 0) / perSentencePPL.length
  const varPPL = perSentencePPL.reduce((sum, p) => sum + Math.pow(p - avgPPL, 2), 0) / perSentencePPL.length
  const stdPPL = Math.sqrt(varPPL)
  
  // 归一化得分：低平均 + 低方差 = 高AI得分
  // avgPPL 通常范围 50-500（短文本更高，长文本更低）
  // AI文本在长文本中困惑度更低（可预测性高）
  const normalizedAvg = Math.max(0, Math.min(1, 1 - (avgPPL - 50) / 400))
  const normalizedStd = Math.max(0, Math.min(1, 1 - stdPPL / 50))
  
  // 长文本（>500字）的困惑度更可信，短文本降权
  const lengthFactor = Math.min(1, normalized.length / 500)
  const perplexityScore = Math.min(1, (normalizedAvg * 0.6 + normalizedStd * 0.4) * lengthFactor)
  
  return {
    score: perplexityScore,
    avgPPL: Math.round(avgPPL),
    stdPPL: Math.round(stdPPL),
    details: `平均困惑度 ${Math.round(avgPPL)}，标准差 ${Math.round(stdPPL)}`
  }
}

/**
 * 计算语义过渡平滑度
 * 
 * AI 文本的相邻句子之间词汇重复率异常高（每句都"承上启下"）
 * 人类文本的相邻句子之间跳跃感更强
 * 
 * 衡量方式：相邻句子的 Jaccard 相似度的平均值
 * 高相似度 = 平滑过渡 = AI 特征
 */
function computeTransitionSmoothness(text) {
  const sentences = splitSentences(text)
  const normalized = normalizeText(text)
  if (sentences.length < 5) return { score: 0.5, details: '句子太少，过渡分析不可靠' }
  
  // 对每个句子提取关键词（去停用词后的实词）
  const stopWords = '的了着过把被对于在在和与等跟从向沿着朝着按照凭靠根据关于由于为了除了比同跟和或及以及不但因为所以虽然但是如果然而而且因此这那什么怎么如何哪个哪些这些那些一个一些所有每个这种那样'
  
  function getKeywords(sentence) {
    const clean = sentence.replace(/[，。！？；：、""''（）()《》【】「」『』…—–\d]/g, ' ')
    const words = clean.split(/\s+/).filter(w => w.length >= 2)
    return words.filter(w => !stopWords.includes(w))
  }
  
  const allKeyWords = sentences.map(getKeywords)
  
  // 计算相邻句子的 Jaccard 相似度
  let totalSimilarity = 0
  let pairCount = 0
  
  for (let i = 0; i < allKeyWords.length - 1; i++) {
    const current = new Set(allKeyWords[i])
    const next = new Set(allKeyWords[i + 1])
    if (current.size === 0 || next.size === 0) continue
    
    let intersection = 0
    current.forEach(w => { if (next.has(w)) intersection++ })
    
    const union = new Set([...current, ...next]).size
    const jaccard = intersection / union
    
    totalSimilarity += jaccard
    pairCount++
  }
  
  if (pairCount === 0) return { score: 0.5, details: '无法提取有效关键词' }
  
  const avgSimilarity = totalSimilarity / pairCount
  // 高相似度 = AI特征（过度平滑）
  // 典型人类范围 0.02-0.10，AI 范围 0.08-0.25
  // 但仅对长文本有效（>300字），短文本/标签文本的词汇重叠不可靠
  const lengthThreshold = normalized.length > 300 ? 1 : 0.3
  const smoothnessScore = lengthThreshold * Math.min(1, Math.max(0, (avgSimilarity - 0.03) * 5))
  
  return {
    score: smoothnessScore,
    avgSimilarity: Math.round(avgSimilarity * 100) / 100,
    details: `句间词汇重叠率 ${(avgSimilarity * 100).toFixed(1)}%`
  }
}

/**
 * 计算词汇多样性曲线
 * 将文章分为前半/后半，分别计算 TTR
 * AI 文本从头到尾 TTR 几乎不变
 * 人类文本后半段 TTR 通常会下降（用词逐渐收窄）或上升（引入新概念）
 */
function computeLexicalVarietyCurve(text) {
  const sentences = splitSentences(text)
  const normalized = normalizeText(text)
  if (sentences.length < 8) return { score: 0.5, details: '句子太少，曲线分析不可靠' }
  
  const half = Math.floor(sentences.length / 2)
  const firstHalf = sentences.slice(0, half).join('')
  const secondHalf = sentences.slice(half).join('')
  
  function getTTR(segment) {
    const chars = segment.replace(/\s/g, '').split('')
    if (chars.length < 10) return 0
    return new Set(chars).size / chars.length
  }
  
  const ttrFirst = getTTR(firstHalf)
  const ttrSecond = getTTR(secondHalf)
  const ttrDiff = Math.abs(ttrFirst - ttrSecond)
  
  // AI 文本前后 TTR 几乎不变（差异 < 0.01）
  // 人类文本前后 TTR 有变化（差异 > 0.02）
  // 但说理文的TTR变化本身就小（单一主题），降低此维度对argumentative的重量
  const isArgumentative = /[一二三四五六七八九十]+[、.．]/.test(text) || /首先[，,].*其次/.test(text)
  const varietyThreshold = isArgumentative ? 0.008 : 0.012
  
  if (ttrDiff < varietyThreshold) {
    // AI特征：前后词汇多样性几乎完全一样
    return { score: 0.8, ttrFirst, ttrSecond, ttrDiff, details: '前后词汇多样性几乎不变' }
  } else if (ttrDiff < 0.02) {
    return { score: 0.5, ttrFirst, ttrSecond, ttrDiff, details: '前后词汇多样性变化较小' }
  } else {
    return { score: 0.2, ttrFirst, ttrSecond, ttrDiff, details: `前后词汇多样性有明显变化（差异 ${(ttrDiff * 100).toFixed(1)}%）` }
  }
}

/**
 * 综合分析入口
 * 返回语义层面的 AI 概率得分 [0, 1]
 */
function analyzeSemantic(text) {
  const perplexity = computePerplexity(text)
  const smoothness = computeTransitionSmoothness(text)
  const variety = computeLexicalVarietyCurve(text)
  
  // 加权融合：平滑度仅对有明显特征的文本生效
  const weights = { perplexity: 0.50, smoothness: 0.20, variety: 0.30 }
  
  const overall = 
    perplexity.score * weights.perplexity +
    smoothness.score * weights.smoothness +
    variety.score * weights.variety
  
  return {
    overallScore: Math.round(overall * 100),
    components: {
      perplexity,
      smoothness,
      variety,
    }
  }
}

module.exports = {
  analyzeSemantic,
  computePerplexity,
  computeTransitionSmoothness,
  computeLexicalVarietyCurve,
}
