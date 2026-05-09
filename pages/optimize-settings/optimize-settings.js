const { STORAGE_KEYS, analyzeArticle, humanizeArticle, evaluateRewrite, buildRewriteDiff, buildHistoryRecord, saveHistory, normalizeText } = require('../../utils/aiTextEngine')

function getMeaningText(text) {
  return normalizeText(text)
    .replace(/[，。！？；：、“”‘’（）()《》,.!?;:\s｜|—\-–_]/g, '')
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

Page({
  data: {
    analysis: null,
    intensity: 'medium',
    scene: '通用文本',
    preserveMeaning: true,
    preserveStructure: true,
    busy: false,
    intensities: [
      { key: 'light', name: '轻度优化', desc: '保留原文结构，调整部分AI味明显的表达' },
      { key: 'medium', name: '中度优化', desc: '调整句式和表达方式，让表达更自然' },
      { key: 'deep', name: '深度优化', desc: '重组语感和结构，更像真人写作' },
    ],
    scenes: [
      { name: '通用文本', icon: '◎' }, { name: '公众号', icon: '✎' }, { name: '小红书', icon: '✦' },
      { name: '论文', icon: '□' }, { name: '职场', icon: '▣' }, { name: '口播', icon: '▶' },
    ],
  },
  onShow() {
    const analysis = wx.getStorageSync(STORAGE_KEYS.currentAnalysis)
    this.setData({ analysis, scene: analysis && analysis.articleType ? analysis.articleType.replace('文章', '') : '通用文本' })
  },
  selectIntensity(event) { this.setData({ intensity: event.currentTarget.dataset.key }) },
  selectScene(event) { this.setData({ scene: event.currentTarget.dataset.name }) },
  toggleMeaning(event) { this.setData({ preserveMeaning: event.detail.value }) },
  toggleStructure(event) { this.setData({ preserveStructure: event.detail.value }) },
  goBack() { wx.navigateBack() },
  goHome() { wx.switchTab({ url: '/pages/index/index' }) },
  startOptimize() {
    const analysis = this.data.analysis
    if (!analysis || !analysis.text) { wx.showToast({ title: '请先输入文章', icon: 'none' }); return }
    this.setData({ busy: true })
    const options = {
      intensity: this.data.intensity,
      scene: this.data.scene,
      preserveMeaning: this.data.preserveMeaning,
      preserveStructure: this.data.preserveStructure,
      referenceText: analysis.referenceText || '',
      articleType: this.data.scene,
      pass: Number(analysis.optimizeRound || 0) + 1,
      forceChange: Number(analysis.score || 0) > 5,
    }
    const before = analyzeArticle(analysis.text, options)
    if (before.score < 5) {
      this.setData({ busy: false })
      wx.showToast({ title: '没有可以优化的内容', icon: 'none' })
      return
    }
    let best = null
    const firstPass = options.pass
    for (let offset = 0; offset < 4; offset += 1) {
      const candidateOptions = { ...options, pass: firstPass + offset, forceChange: Number(before.score || 0) > 5 }
      const rewritten = humanizeArticle(analysis.text, candidateOptions)
      const after = analyzeArticle(rewritten.text, candidateOptions)
      const diff = buildRewriteDiff(analysis.text, rewritten.text)
      const changed = hasSubstantiveContentChange(analysis.text, rewritten.text) && diff.some((block) => block.changedFragments && block.changedFragments.length)
      const candidate = { rewritten, after, options: candidateOptions, changed, diff }
      if (changed && (!best || after.score < best.after.score || (after.score === best.after.score && candidateOptions.pass > best.options.pass))) best = candidate
      if (changed && after.score < before.score) break
    }
    if (!best) {
      this.setData({ busy: false })
      wx.showToast({ title: '没有可以优化的内容', icon: 'none' })
      return
    }
    const quality = evaluateRewrite(analysis.text, best.rewritten.text, best.options)
    quality.after.referenceText = analysis.referenceText || ''
    quality.after.styleProfile = analysis.styleProfile || null
    quality.after.optimizeRound = best.options.pass
    const originalText = analysis.originalText || analysis.text
    quality.after.originalText = originalText
    const optimize = {
      original: originalText,
      currentInputText: analysis.text,
      optimizedText: best.rewritten.text,
      diff: buildRewriteDiff(originalText, best.rewritten.text),
      before,
      after: quality.after,
      qualityReport: quality,
      options: best.options,
      styleProfile: best.rewritten.styleProfile,
      createdAt: Date.now(),
    }
    wx.setStorageSync(STORAGE_KEYS.currentOptimize, optimize)
    saveHistory(buildHistoryRecord({ type: 'optimize', title: analysis.title, score: quality.before.score, afterScore: quality.after.score, wordCount: quality.after.wordCount, scene: this.data.scene, analysis, optimize }))
    this.setData({ busy: false })
    wx.navigateTo({ url: '/pages/optimize-result/optimize-result' })
  },
})
