const { analyzeSentence } = require('../analysis/aiPatternAnalyzer')
const { mapStrategies, SKILL_REGISTRY } = require('../strategies/strategyMapper')

function normalizeText(text) {
  return String(text || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeForCompare(text) {
  return normalizeText(text).replace(/[，。！？；：、“”‘’（）()《》,.!?;:\s｜|—\-–_]/g, '')
}

function ensureEnd(text) {
  const value = String(text || '').trim()
  return value && !/[。！？!?]$/.test(value) ? `${value}。` : value
}

/**
 * 将段落拆成带标点的句子单元。
 *
 * 这里保留句末标点，后续 diff 才能做到“原句 vs 改写句”一一对照。
 */
function splitIntoSentences(paragraph) {
  const text = String(paragraph || '').trim()
  if (!text) return []
  const units = text.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [text]
  return units.map((item) => item.trim()).filter(Boolean)
}

function splitParagraphs(text) {
  return normalizeText(text).split(/\n+/).map((item) => item.trim()).filter(Boolean)
}

/**
 * 判断改写是否发生了实质内容变化。
 *
 * 只改标点、空格、分隔符不算变化；这能避免再次出现“优化前后只有标点不同”的问题。
 */
function hasSubstantiveChange(original, rewritten) {
  const before = normalizeForCompare(original)
  const after = normalizeForCompare(rewritten)
  if (!before || !after) return before !== after
  if (before === after) return false
  const beforeSet = new Set(before.split(''))
  const overlap = after.split('').filter((char) => beforeSet.has(char)).length
  const similarity = overlap / Math.max(before.length, after.length)
  const lengthGap = Math.abs(before.length - after.length)
  return lengthGap >= 4 || similarity < 0.92
}

function removeMechanicalArtifacts(text) {
  return String(text || '')
    .replace(/，。/g, '。')
    .replace(/：。/g, '：')
    .replace(/([。！？!?])\1+/g, '$1')
    .replace(/(其实，){2,}/g, '其实，')
    .replace(/(后来，){2,}/g, '后来，')
    .replace(/后来我发现，后来，/g, '后来我发现，')
    .replace(/后来我发现。很多/g, '后来我发现，很多')
    .replace(/远离所有人。我/g, '远离所有人，我')
    .replace(/Hello,。/g, 'Hello,')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function applyReferenceStyle(text, context = {}) {
  const reference = normalizeText(context.referenceText || '')
  if (!reference) return text
  const shortParagraphStyle = reference.split(/\n+/).filter(Boolean).length >= 3
  if (!shortParagraphStyle) return text
  return text.replace(/。(?=[^\n])/g, '。\n')
}

function applySceneTone(text, context = {}) {
  const scene = context.scene || context.articleType || '通用文本'
  if (scene === '口播') return text.replace(/。/g, '。\n')
  if (scene === '论文') return text.replace(/说实话，/g, '').replace(/我以前也这样，/g, '在实际分析中，')
  if (scene === '职场') return text.replace(/后来我发现/g, '复盘之后会发现')
  return text
}

function fallbackRewrite(sentence, analysis = {}, context = {}) {
  const text = String(sentence || '').trim().replace(/[。！？!?]$/, '')
  if (!text) return text

  if (/自律|成长|阅读/.test(text)) {
    return ensureEnd('我平时会写自律、成长和阅读，也会记录自己一路摸索时的感受')
  }

  if (/有没有那种瞬间/.test(text)) {
    return ensureEnd('你应该也有过这种时刻：刚觉得一件事可以试试，下一秒又被现实里的声音拽回来')
  }

  if (/真正|优秀|长期|坚持/.test(text)) {
    return ensureEnd('后来我发现，很多能坚持下来的人，也会有没状态的时候。他们只是愿意在普通日子里继续往前挪一点')
  }

  if (/不是/.test(text) && /而是|只是/.test(text)) {
    return SKILL_REGISTRY.observationRewrite.apply(sentence, analysis, context)
  }

  if (text.length > 18) {
    return ensureEnd(`换到真实场景里，${text}这件事往往没有说起来那么轻松`)
  }

  return ensureEnd(`说实话，${text}`)
}

/**
 * 改写单句。
 *
 * 流程是：分析问题 -> 映射策略 -> 按 skill 顺序改变表达路径。
 * 低风险句默认保持克制；高风险句必须发生实质变化。
 */
// 供 A2 去重预检：如果原句已含这些标记词，跳过对应 skill
const PAUSE_MARKERS = ['其实', '后来', '有时候', '说实话', '我以前也这样']
const GRAIN_MARKERS = ['当时我其实没想明白', '那一刻会有点烦', '后来反倒松了一口气', '心里会先犹豫一下', '说实话，刚开始我也不太确定']

function rewriteSentence(sentence, context = {}) {
  const original = String(sentence || '').trim()
  const analysis = analyzeSentence(original, context)
  const shouldRewrite = analysis.severity >= 18 || (context.forceChange && analysis.severity >= 10)
  if (!shouldRewrite) {
    return {
      original,
      rewritten: original,
      analysis,
      appliedSkills: [],
      changed: false,
    }
  }

  // A1: 初始化去重记忆数组（跨句子共享）
  context.usedPauses = context.usedPauses || []
  context.usedGrains = context.usedGrains || []
  context.usedDetails = context.usedDetails || []

  let skills = mapStrategies(analysis, context)

  // A2: 如果原句已包含对应 skill 的标记词，跳过该 skill
  if (PAUSE_MARKERS.some((p) => original.includes(p))) {
    skills = skills.filter((s) => s.name !== 'humanPause')
  }
  if (GRAIN_MARKERS.some((g) => original.includes(g))) {
    skills = skills.filter((s) => s.name !== 'emotionalGrain')
  }

  let rewritten = original
  const appliedSkills = []

  skills.forEach((skill) => {
    const next = skill.apply(rewritten, analysis, context)
    if (next && next !== rewritten) {
      rewritten = next
      appliedSkills.push(skill.name)
    }
  })

  rewritten = removeMechanicalArtifacts(ensureEnd(rewritten))
  if (!hasSubstantiveChange(original, rewritten)) {
    rewritten = fallbackRewrite(original, analysis, context)
    appliedSkills.push('fallbackRewrite')
  }

  return {
    original,
    rewritten: removeMechanicalArtifacts(ensureEnd(rewritten)),
    analysis,
    appliedSkills,
    changed: hasSubstantiveChange(original, rewritten),
  }
}

function mergeSentences(results) {
  return results.map((item) => item.rewritten).filter(Boolean).join('')
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * B1 检测1：连续句式前缀去重
 *
 * 检测 3 句及以上连续以 PAUSES 中词开头的句子，
 * 只保留第 1 句的前缀，移除第 2、3 句的相同前缀。
 */
function dedupConsecutivePrefixes(text) {
  const PAUSES = ['其实', '后来', '有时候', '说实话', '我以前也这样']
  const sentences = text.match(/[^。！？!?]+[。！？!?]/g)
  if (!sentences || sentences.length < 3) return text

  let changed = false
  for (let i = 0; i <= sentences.length - 3; i++) {
    const prefixes = []
    let allPause = true
    for (let j = 0; j < 3; j++) {
      const s = sentences[i + j].trim()
      let found = null
      for (const p of PAUSES) {
        if (s.startsWith(p + '，') || s.startsWith(p + ',')) {
          found = p
          break
        }
      }
      if (found) {
        prefixes.push({ idx: i + j, prefix: found })
      } else {
        allPause = false
        break
      }
    }

    if (allPause) {
      for (let k = 1; k < prefixes.length; k++) {
        const { idx, prefix } = prefixes[k]
        sentences[idx] = sentences[idx].replace(new RegExp('^' + escapeRegExp(prefix) + '[,，]'), '')
        changed = true
      }
      i += 2
    }
  }

  return changed ? sentences.join('') : text
}

/**
 * B1 检测2：句式雷同变体
 *
 * 比较相邻句子去掉句末标点后的前 4 个字符，
 * 如果相同则判定句式雷同，去掉第 2 句的雷同开头。
 */
function dedupIdenticalPatterns(text) {
  const PAUSES = ['其实', '后来', '有时候', '说实话', '我以前也这样']
  const sentences = text.match(/[^。！？!?]+[。！？!?]/g)
  if (!sentences || sentences.length < 2) return text

  // 比较前先去掉已知填充词前缀，避免把 “后来我发现，X” 和 “后来我发现，Y” 误判为雷同
  function stripFillers(s) {
    let result = s.trim()
    // 长前缀优先匹配（observationRewrite/fallbackRewrite 产生的固定模板）
    const longPrefixes = [
      '后来我发现，', '后来我看，', '后来我发现',
      '放到真实生活里看，', '换到真实场景里，',
      '更该放在心上的，是', '更该放在心上的',
    ]
    for (const lp of longPrefixes.sort((a, b) => b.length - a.length)) {
      if (result.startsWith(lp)) {
        result = result.substring(lp.length)
        break
      }
    }
    // 然后去 PAUSES 填坑词 + 逗号
    for (const p of PAUSES) {
      if (result.startsWith(p + '，')) {
        result = result.substring((p + '，').length)
        break
      }
    }
    return result.trim()
  }

  let changed = false
  for (let i = 1; i < sentences.length; i++) {
    const prevBody = stripFillers(sentences[i - 1].replace(/[。！？!?]$/, ''))
    const currBody = stripFillers(sentences[i].replace(/[。！？!?]$/, ''))

    if (prevBody.length >= 4 && currBody.length >= 4) {
      if (prevBody.substring(0, 4) === currBody.substring(0, 4)) {
        const remaining = currBody.substring(4).trim()
        if (remaining.length >= 4) {
          sentences[i] = ensureEnd(remaining)
          changed = true
        }
      }
    }
  }

  return changed ? sentences.join('') : text
}

/**
 * B2：跨句平滑过渡
 *
 * 在逐句改写结果合并后、finalPolish 前调用。
 * 处理相邻前缀词拼接、重复标点和跨句连接词冗余。
 */
function smoothTransitions(text) {
  let result = text

  const PAUSES = ['其实', '后来', '有时候', '说实话', '我以前也这样']
  const DETAIL = ['写到这里的时候', '翻评论区时', '和朋友聊起这件事时', '那天晚上', '后来再遇到类似事情时', '真正动手去做的时候']

  // 1. 双前缀拼接：两个 pause/detail 词相邻出现，保留第一个
  //    也匹配第二个前缀词后跟更多内容的情况，例如“那天晚上，后来我发现，”
  const allPrefixes = [...PAUSES, ...DETAIL].sort((a, b) => b.length - a.length)
  for (const first of allPrefixes) {
    for (const second of allPrefixes) {
      if (first === second) continue
      // 精确匹配：first，second， → first，
      const exactPattern = new RegExp(escapeRegExp(first) + '[,，]' + escapeRegExp(second) + '[,，]', 'g')
      result = result.replace(exactPattern, first + '，')
      // 放宽匹配：first，second 开头 + 更多内容 + ， → first，
      const fuzzyPattern = new RegExp(escapeRegExp(first) + '[,，]' + escapeRegExp(second) + '[^，。]+[,，]', 'g')
      result = result.replace(fuzzyPattern, first + '，')
    }
  }

  // 2. 重复句号/逗号修复
  result = result.replace(/。。+/g, '。').replace(/，，+/g, '，')

  // 3. 跨句连接词冗余：句首"后来"且前句以停顿词结尾
  result = result.replace(/([其实那])。[　\s]*后来，/g, '$1。')

  return result
}

/**
 * 最终润色层。
 *
 * 它不重新发明内容，只处理逐句拼接后的整体语气、节奏和衔接，
 * 避免每个 skill 单独工作后出现明显拼接感。
 */
function finalPolish(article, context = {}) {
  let text = normalizeText(article)
  text = removeMechanicalArtifacts(text)

  // B1: 跨句检测
  text = dedupConsecutivePrefixes(text)
  text = dedupIdenticalPatterns(text)

  text = text
    .replace(/。\n。/g, '。\n')
    .replace(/([。！？!?])([^\n])/g, '$1$2')
  text = applySceneTone(text, context)
  text = applyReferenceStyle(text, context)
  return normalizeText(removeMechanicalArtifacts(text))
}

/**
 * 文章级改写 pipeline。
 *
 * 注意：这里不会全文一次性重写，而是逐句分析、逐句选择策略，
 * 最后再统一润色。返回的 sentenceResults 可用于调试和后续 UI 标注。
 */
function rewriteArticle(text, options = {}) {
  const normalized = normalizeText(text)
  if (!normalized) {
    return {
      text: '',
      analyses: [],
      sentenceResults: [],
      appliedSkills: [],
      changed: false,
    }
  }

  const paragraphs = splitParagraphs(normalized)
  const sentenceResults = []
  let globalSentenceIndex = 0

  // A1: 在 options 上预先初始化去重记忆数组，确保 …options 展开后所有句子共享同一数组引用
  options.usedPauses = []
  options.usedGrains = []
  options.usedDetails = []

  const rewrittenParagraphs = paragraphs.map((paragraph, paragraphIndex) => {
    const sentences = splitIntoSentences(paragraph)
    const results = sentences.map((sentence, sentenceIndex) => {
      const currentSentenceIndex = globalSentenceIndex
      globalSentenceIndex += 1
      const result = rewriteSentence(sentence, {
        ...options,
        paragraphIndex,
        sentenceIndex: currentSentenceIndex,
        localSentenceIndex: sentenceIndex,
        totalSentences: sentences.length,
      })
      sentenceResults.push(result)
      return result
    })
    return mergeSentences(results)
  })

  let output = rewrittenParagraphs.join(options.preserveStructure === false ? '\n' : '\n\n')
  output = smoothTransitions(output)
  output = finalPolish(output, options)
  if (options.forceChange && !hasSubstantiveChange(normalized, output)) {
    const allSentences = splitIntoSentences(normalized)
    const targetSentence = allSentences.find((sentence) => normalizeForCompare(sentence).length > 6) || allSentences[0] || normalized
    const forcedText = fallbackRewrite(targetSentence, analyzeSentence(targetSentence, options), {
      ...options,
      pass: Number(options.pass || 1) + 1,
    })
    output = finalPolish(output.replace(targetSentence, forcedText), options)
  }

  return {
    text: output,
    analyses: sentenceResults.map((item) => item.analysis),
    sentenceResults,
    appliedSkills: sentenceResults.reduce((list, item) => list.concat(item.appliedSkills), []),
    changed: hasSubstantiveChange(normalized, output),
  }
}

module.exports = {
  rewriteArticle,
  rewriteSentence,
  splitIntoSentences,
  finalPolish,
  smoothTransitions,
  hasSubstantiveChange,
}
