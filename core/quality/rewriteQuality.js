/**
 * 改写质量自动评估。
 *
 * 按 rewriting-standard.md 的 S/A/B/C/D 等级标准，
 * 对改写结果进行自动评分，输出等级和扣分原因。
 *
 * 历史：之前仅依赖 hasSubstantiveChange 检查是否发生了变更，
 * 缺少对改写质量本身（模板感/机械替换/语气词堆砌等）的评估。
 */

/**
 * 归一化文本用于对比（去标点、去空格、去特殊字符，保留汉字和数字）。
 */
function normalizeForCompare(text) {
  return String(text || '')
    .replace(/[，。！？；：、""''（）()《》,.!?;:\s｜|—\-–_\[\]]/g, '')
    .trim()
}

/**
 * 检查是否只是机械替换（同义词轮换，句法结构未变）。
 */
function checkMechanicalReplace(original, rewritten) {
  // 如果标点/连接词以外的核心词替换率很高但句长不变 → 机械替换嫌疑
  const origChars = normalizeForCompare(original)
  const rewrtChars = normalizeForCompare(rewritten)
  if (!origChars || !rewrtChars) return false

  const lengthDelta = Math.abs(origChars.length - rewrtChars.length)
  if (lengthDelta > 6) return false // 句长明显变了，不太可能是纯替换

  const origSet = new Set(origChars)
  const overlap = rewrtChars.split('').filter((c) => origSet.has(c)).length
  const similarity = overlap / Math.max(origChars.length, rewrtChars.length, 1)

  // 相似度高且长度变化小 → 大概率只是换了几个词
  return similarity > 0.85 && lengthDelta <= 4
}

/**
 * 检查语气词堆砌。
 */
function checkFillerOveruse(text) {
  const fillers = ['其实', '后来', '说实话', '有时候', '我以前也这样', '那一刻', '回头看']
  let total = 0
  const details = []
  for (const filler of fillers) {
    const count = (text.match(new RegExp(filler, 'g')) || []).length
    if (count > 0) {
      total += count
      details.push({ word: filler, count })
    }
  }

  const sentences = text.split(/[。！？!?；;]+/).filter(Boolean).length || 1
  const density = total / sentences

  return {
    overused: density > 0.5, // 平均每两句就有一个语气词 → 堆砌
    density: Math.round(density * 100) / 100,
    totalFillers: total,
    details,
  }
}

/**
 * 检查是否有新的模板句式被引入。
 */
function checkNewTemplates(text) {
  const templatePatterns = [
    { pattern: /不是[^。！？；;\n]{1,46}而是/g, label: '不是…而是…对照结构' },
    { pattern: /一方面[^。！？\n]{1,70}另一方面/g, label: '一方面…另一方面…' },
    { pattern: /与其[^。！？；;\n]{1,46}不如/g, label: '与其…不如…' },
    { pattern: /综上所述|总而言之|不难看出/g, label: '总结口吻' },
    { pattern: /值得注意的是|不可忽视/g, label: '套话表达' },
    { pattern: /底层逻辑|长期主义|情绪价值|松弛感/g, label: '概念词滥用' },
    { pattern: /本质上|归根结底|说到底/g, label: '总结收束词' },
    { pattern: /确实，|的确,/g, label: '突兀肯定' },
  ]

  const hits = []
  for (const { pattern, label } of templatePatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length) {
      hits.push({ label, count: matches.length })
    }
  }
  return hits
}

/**
 * 检查关键事实是否被保留。
 */
function checkFactPreservation(original, rewritten) {
  // 提取数字
  const numsOrig = original.match(/\d+(\.\d+)?%?/g) || []
  const numsRewr = rewritten.match(/\d+(\.\d+)?%?/g) || []
  for (const num of numsOrig) {
    if (!numsRewr.includes(num) && !numsRewr.some((n) => n.startsWith(num))) {
      return { preserved: false, missing: [`数字"${num}"丢失`] }
    }
  }

  // 提取引号/书名号内容
  const quotesOrig = original.match(/[""「」《][^"「」《》]+[""」」》]/g) || []
  const quotesRewr = rewritten.match(/[""「」《][^"「」《》]+[""」」》]/g) || []
  for (const q of quotesOrig) {
    const clean = q.replace(/[""「」《》]/g, '')
    if (!quotesRewr.some((r) => r.includes(clean))) {
      return { preserved: false, missing: [`引号内容"${clean}"丢失`] }
    }
  }

  return { preserved: true, missing: [] }
}

/**
 * 评估改写质量等级。
 *
 * @param {string} original - 原文
 * @param {string} rewritten - 改写后文本
 * @param {object} [options]
 * @returns {object} { grade, score, issues, details }
 *
 * 等级标准（对应 rewriting-standard.md）：
 *   S: 95-100 — 完全看不出 AI 味
 *   A: 80-94  — 无明显模板感，读感自然
 *   B: 60-79  — 大部分自然，少数句子仍有模板感
 *   C: 30-59  — 仅同义词替换/标点调整
 *   D: 0-29   — 事实改变或丢失
 */
function evaluateRewriteQuality(original, rewritten, options = {}) {
  if (!rewritten) {
    return { grade: 'D', score: 0, issues: ['改写结果为空'], details: [] }
  }

  const issues = []
  const details = []
  let score = 100

  // 1. 检查是否有实质变更
  const origNorm = String(original || '').replace(/[，。！？；：、""''（）()《》,.!?;:\s]/g, '')
  const rewrtNorm = String(rewritten).replace(/[，。！？；：、""''（）()《》,.!?;:\s]/g, '')
  if (origNorm === rewrtNorm) {
    score -= 50
    issues.push('没有实质变更（仅标点/空格不同）')
    details.push({ type: 'no_change', severity: 'critical', desc: '原文与改写后无实质差异' })
  }

  // 2. 检查机械替换
  if (checkMechanicalReplace(original, rewritten)) {
    score -= 20
    issues.push('疑似机械替换——仅换了同义词，句法结构未变')
    details.push({ type: 'mechanical_replace', severity: 'high', desc: '仅做同义词轮换，句法结构未调整' })
  }

  // 3. 检查语气词堆砌
  const fillerResult = checkFillerOveruse(rewritten)
  if (fillerResult.overused) {
    const penalty = Math.min(15, Math.round(fillerResult.density * 20))
    score -= penalty
    issues.push(`语气词堆砌（密度 ${fillerResult.density}，共 ${fillerResult.totalFillers} 个）：${fillerResult.details.map((d) => `"${d.word}"×${d.count}`).join('、')}`)
    details.push({ type: 'filler_overuse', severity: 'medium', desc: `语气词密度 ${fillerResult.density}/句` })
  }

  // 4. 检查新引入的模板句式
  const newTemplates = checkNewTemplates(rewritten)
  if (newTemplates.length > 0) {
    const penalty = Math.min(25, newTemplates.reduce((s, t) => s + t.count * 5, 0))
    score -= penalty
    issues.push(`改写后仍含 ${newTemplates.length} 类模板句式：${newTemplates.map((t) => `${t.label}×${t.count}`).join('、')}`)
    details.push({ type: 'remaining_templates', severity: 'high', desc: newTemplates.map((t) => `${t.label}(${t.count}次)`).join('、') })
  }

  // 5. 检查事实保留
  const factResult = checkFactPreservation(original, rewritten)
  if (!factResult.preserved) {
    score = Math.min(score, 29) // 事实丢失直接降到 D 级
    issues.push(`事实丢失：${factResult.missing.join('、')}`)
    details.push({ type: 'fact_loss', severity: 'critical', desc: factResult.missing.join('；') })
  }

  // 6. 检查改写是否太短（比原文短太多可能丢失了内容）
  if (rewritten.length < original.length * 0.4 && original.length > 20) {
    score -= 10
    issues.push('改写后过短，可能丢失了大量内容')
    details.push({ type: 'too_short', severity: 'medium', desc: `原文${original.length}字 → 改后${rewritten.length}字` })
  }

  // 7. 检查改写后句长是否均匀（太均匀也是 AI 味的标志）
  const sentences = rewritten.split(/[。！？!?；;]+/).filter(Boolean)
  if (sentences.length >= 3) {
    const lengths = sentences.map((s) => s.length)
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length
    const stdDev = Math.sqrt(variance)
    if (stdDev < avg * 0.2) {
      // 句长过于均匀
      score -= 8
      issues.push('句长过于均匀（标准差偏小），读感偏模板')
      details.push({ type: 'uniform_length', severity: 'low', desc: `句长标准差 ${Math.round(stdDev)}，均值 ${Math.round(avg)}，相对偏差 ${Math.round(stdDev / avg * 100)}%` })
    }
  }

  // 最终分和等级
  score = Math.max(0, Math.min(100, score))

  let grade
  if (score >= 95) grade = 'S'
  else if (score >= 80) grade = 'A'
  else if (score >= 60) grade = 'B'
  else if (score >= 30) grade = 'C'
  else grade = 'D'

  return {
    grade,
    score,
    issues,
    details,
    fillerAnalysis: fillerResult,
    templateHits: newTemplates,
    factPreserved: factResult.preserved,
  }
}

module.exports = {
  evaluateRewriteQuality,
  checkMechanicalReplace,
  checkFillerOveruse,
  checkNewTemplates,
  checkFactPreservation,
}
