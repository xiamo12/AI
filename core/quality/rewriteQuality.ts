// ============================================================
// 改写质量自动评估 — S/A/B/C/D 等级评定
//
// @version 1.0
// ============================================================

interface FillerResult {
  overused: boolean
  density: number
  totalFillers: number
  details: Array<{ word: string; count: number }>
}

interface TemplateHit {
  label: string
  count: number
}

interface FactResult {
  preserved: boolean
  missing: string[]
}

interface QualityDetail {
  type: string
  severity: string
  desc: string
}

interface RewriteQualityResult {
  grade: string
  score: number
  issues: string[]
  details: QualityDetail[]
  fillerAnalysis: FillerResult
  templateHits: TemplateHit[]
  factPreserved: boolean
}

// ---- 工具函数 ----

function normalizeForCompare(text: string): string {
  return String(text || '')
    .replace(/[，。！？；：、""''（）()《》,.!?;:\s｜|—\-–_\[\]]/g, '')
    .trim()
}

// ---- 检查器 ----

function checkMechanicalReplace(original: string, rewritten: string): boolean {
  const origChars = normalizeForCompare(original)
  const rewrtChars = normalizeForCompare(rewritten)
  if (!origChars || !rewrtChars) return false

  const lengthDelta = Math.abs(origChars.length - rewrtChars.length)
  if (lengthDelta > 6) return false

  const origSet = new Set(origChars)
  const overlap = rewrtChars.split('').filter((c) => origSet.has(c)).length
  const similarity = overlap / Math.max(origChars.length, rewrtChars.length, 1)

  return similarity > 0.85 && lengthDelta <= 4
}

function checkFillerOveruse(text: string): FillerResult {
  const fillers = ['其实', '后来', '说实话', '有时候', '我以前也这样', '那一刻', '回头看']
  let total = 0
  const details: Array<{ word: string; count: number }> = []

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
    overused: density > 0.5,
    density: Math.round(density * 100) / 100,
    totalFillers: total,
    details,
  }
}

function checkNewTemplates(text: string): TemplateHit[] {
  const templatePatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /不是[^。！？；;\n]{1,46}而是/g, label: '不是…而是…对照结构' },
    { pattern: /一方面[^。！？\n]{1,70}另一方面/g, label: '一方面…另一方面…' },
    { pattern: /与其[^。！？；;\n]{1,46}不如/g, label: '与其…不如…' },
    { pattern: /综上所述|总而言之|不难看出/g, label: '总结口吻' },
    { pattern: /值得注意的是|不可忽视/g, label: '套话表达' },
    { pattern: /底层逻辑|长期主义|情绪价值|松弛感/g, label: '概念词滥用' },
    { pattern: /本质上|归根结底|说到底/g, label: '总结收束词' },
    { pattern: /确实，|的确,/g, label: '突兀肯定' },
  ]

  const hits: TemplateHit[] = []
  for (const { pattern, label } of templatePatterns) {
    const matches = text.match(pattern)
    if (matches && matches.length) {
      hits.push({ label, count: matches.length })
    }
  }
  return hits
}

function checkFactPreservation(original: string, rewritten: string): FactResult {
  const numsOrig: string[] = original.match(/\d+(\.\d+)?%?/g) || []
  const numsRewr: string[] = rewritten.match(/\d+(\.\d+)?%?/g) || []
  for (const num of numsOrig) {
    if (!numsRewr.includes(num) && !numsRewr.some((n) => n.startsWith(num))) {
      return { preserved: false, missing: [`数字"${num}"丢失`] }
    }
  }

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

// ---- 主评估函数 ----

function evaluateRewriteQuality(
  original: string,
  rewritten: string,
  _options?: Record<string, unknown>,
): RewriteQualityResult {
  if (!rewritten) {
    return {
      grade: 'D', score: 0, issues: ['改写结果为空'], details: [],
      fillerAnalysis: { overused: false, density: 0, totalFillers: 0, details: [] },
      templateHits: [], factPreserved: true,
    }
  }

  const issues: string[] = []
  const details: QualityDetail[] = []
  let score = 100

  // 1. 实质变更检查
  const origNorm = String(original || '').replace(/[，。！？；：、""''（）()《》,.!?;:\s]/g, '')
  const rewrtNorm = String(rewritten).replace(/[，。！？；：、""''（）()《》,.!?;:\s]/g, '')
  if (origNorm === rewrtNorm) {
    score -= 50
    issues.push('没有实质变更（仅标点/空格不同）')
    details.push({ type: 'no_change', severity: 'critical', desc: '原文与改写后无实质差异' })
  }

  // 2. 机械替换
  if (checkMechanicalReplace(original, rewritten)) {
    score -= 20
    issues.push('疑似机械替换——仅换了同义词，句法结构未变')
    details.push({ type: 'mechanical_replace', severity: 'high', desc: '仅做同义词轮换，句法结构未调整' })
  }

  // 3. 语气词堆砌
  const fillerResult = checkFillerOveruse(rewritten)
  if (fillerResult.overused) {
    const penalty = Math.min(15, Math.round(fillerResult.density * 20))
    score -= penalty
    issues.push(`语气词堆砌（密度 ${fillerResult.density}，共 ${fillerResult.totalFillers} 个）：${fillerResult.details.map((d) => `"${d.word}"×${d.count}`).join('、')}`)
    details.push({ type: 'filler_overuse', severity: 'medium', desc: `语气词密度 ${fillerResult.density}/句` })
  }

  // 4. 新模板句式
  const newTemplates = checkNewTemplates(rewritten)
  if (newTemplates.length > 0) {
    const penalty = Math.min(25, newTemplates.reduce((s, t) => s + t.count * 5, 0))
    score -= penalty
    issues.push(`改写后仍含 ${newTemplates.length} 类模板句式：${newTemplates.map((t) => `${t.label}×${t.count}`).join('、')}`)
    details.push({ type: 'remaining_templates', severity: 'high', desc: newTemplates.map((t) => `${t.label}(${t.count}次)`).join('、') })
  }

  // 5. 事实保留
  const factResult = checkFactPreservation(original, rewritten)
  if (!factResult.preserved) {
    score = Math.min(score, 29)
    issues.push(`事实丢失：${factResult.missing.join('、')}`)
    details.push({ type: 'fact_loss', severity: 'critical', desc: factResult.missing.join('；') })
  }

  // 6. 过短检查
  if (rewritten.length < original.length * 0.4 && original.length > 20) {
    score -= 10
    issues.push('改写后过短，可能丢失了大量内容')
    details.push({ type: 'too_short', severity: 'medium', desc: `原文${original.length}字 → 改后${rewritten.length}字` })
  }

  // 7. 句长均匀度
  const sentences = rewritten.split(/[。！？!?；;]+/).filter(Boolean)
  if (sentences.length >= 3) {
    const lengths = sentences.map((s) => s.length)
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length
    const stdDev = Math.sqrt(variance)
    if (stdDev < avg * 0.2) {
      score -= 8
      issues.push('句长过于均匀（标准差偏小），读感偏模板')
      details.push({ type: 'uniform_length', severity: 'low', desc: `句长标准差 ${Math.round(stdDev)}，均值 ${Math.round(avg)}，相对偏差 ${Math.round(stdDev / avg * 100)}%` })
    }
  }

  score = Math.max(0, Math.min(100, score))

  let grade: string
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

export {
  evaluateRewriteQuality,
  checkMechanicalReplace,
  checkFillerOveruse,
  checkNewTemplates,
  checkFactPreservation,
}
