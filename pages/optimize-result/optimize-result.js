const { STORAGE_KEYS, buildRewriteDiff, buildHistoryRecord, saveHistory } = require('../../utils/aiTextEngine')

Page({
  data: { optimize: null, tab: 'diff', dropScore: 0, canContinue: false },
  onShow() {
    const optimize = wx.getStorageSync(STORAGE_KEYS.currentOptimize)
    if (optimize) {
      optimize.original = optimize.original || optimize.before.originalText || optimize.before.text || ''
      optimize.diff = buildRewriteDiff(optimize.original, optimize.optimizedText)
      this.setData({
        optimize,
        dropScore: Math.max(0, optimize.before.score - optimize.after.score),
        canContinue: Number(optimize.after.score || 0) > 5,
      })
    }
  },
  switchTab(event) { this.setData({ tab: event.currentTarget.dataset.tab }) },
  goBack() { wx.navigateBack() },
  goHome() { wx.switchTab({ url: '/pages/index/index' }) },
  copyOptimized() { if (this.data.optimize) wx.setClipboardData({ data: this.data.optimize.optimizedText }) },
  recheckOptimized() {
    if (!this.data.optimize) return
    const optimize = this.data.optimize
    wx.setStorageSync(STORAGE_KEYS.currentAnalysis, {
      ...optimize.after,
      text: optimize.optimizedText,
      originalText: optimize.original,
      referenceText: optimize.options.referenceText || '',
      styleProfile: optimize.styleProfile || null,
      articleType: optimize.options.scene || optimize.after.articleType || '通用文本',
    })
    wx.navigateTo({ url: '/pages/result/result' })
  },
  continueOptimize() {
    const optimize = this.data.optimize
    if (!optimize) return
    if (Number(optimize.after.score || 0) <= 5) {
      wx.showToast({ title: 'AI痕迹已低于5%', icon: 'none' })
      return
    }
    const nextAnalysis = {
      ...optimize.after,
      text: optimize.optimizedText,
      originalText: optimize.original,
      referenceText: optimize.options.referenceText || '',
      styleProfile: optimize.styleProfile || null,
      articleType: optimize.options.scene || optimize.after.articleType || '通用文本',
      optimizeRound: Number(optimize.options.pass || 1),
    }
    wx.setStorageSync(STORAGE_KEYS.currentAnalysis, nextAnalysis)
    wx.navigateTo({ url: '/pages/optimize-settings/optimize-settings' })
  },
  saveRecord() {
    const optimize = this.data.optimize
    if (!optimize) return
    saveHistory(buildHistoryRecord({ type: 'optimize', title: optimize.after.title, score: optimize.before.score, afterScore: optimize.after.score, wordCount: optimize.after.wordCount, scene: optimize.options.scene, optimize }))
    wx.showToast({ title: '已保存', icon: 'success' })
  },
})
