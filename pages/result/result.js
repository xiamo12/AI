const { STORAGE_KEYS, analyzeArticle, buildHistoryRecord, saveHistory } = require('../../utils/aiTextEngine')

Page({
  data: { analysis: null, gaugeColor: '#13a86d', canOptimize: false, canViewIssues: false },

  onShow() {
    const analysis = wx.getStorageSync(STORAGE_KEYS.currentAnalysis)
    if (analysis) this.setResultState(analysis)
  },

  setResultState(analysis) {
    if (analysis.sourceAnalysis && analysis.sourceAnalysis.length && (!analysis.issues || !analysis.issues.length) && analysis.text) {
      const refreshed = analyzeArticle(analysis.text, { articleType: analysis.articleType })
      analysis = {
        ...refreshed,
        originalText: analysis.originalText || analysis.text,
        referenceText: analysis.referenceText || '',
        styleProfile: analysis.styleProfile || null,
      }
      wx.setStorageSync(STORAGE_KEYS.currentAnalysis, analysis)
    }
    const score = Number(analysis.score || 0)
    const issueCount = analysis.issues && analysis.issues.length ? analysis.issues.length : 0
    this.setData({
      analysis,
      gaugeColor: this.getGaugeColor(score),
      canOptimize: score >= 5,
      canViewIssues: issueCount > 0,
    })
  },

  getGaugeColor(score) {
    if (score >= 85) return '#b91c1c'
    if (score >= 70) return '#ef4444'
    if (score >= 45) return '#f59e0b'
    if (score >= 25) return '#22c55e'
    if (score >= 5) return '#13a86d'
    return '#13a86d'
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  goIssues() {
    if (!this.data.canViewIssues) {
      wx.showToast({ title: '暂无可查看的问题句子', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/issues/issues' })
  },

  goOptimize() {
    if (!this.data.canOptimize) {
      wx.showToast({ title: '恭喜你！无需修改', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/optimize-settings/optimize-settings' })
  },

  recheck() {
    if (!this.data.analysis) return
    const analysis = analyzeArticle(this.data.analysis.text, { articleType: this.data.analysis.articleType })
    analysis.originalText = this.data.analysis.originalText || this.data.analysis.text
    analysis.referenceText = this.data.analysis.referenceText || ''
    analysis.styleProfile = this.data.analysis.styleProfile || null
    wx.setStorageSync(STORAGE_KEYS.currentAnalysis, analysis)
    saveHistory(buildHistoryRecord({ type: 'detect', title: analysis.title, score: analysis.score, wordCount: analysis.wordCount, scene: analysis.articleType, analysis }))
    this.setResultState(analysis)
    wx.showToast({ title: '已重新检测', icon: 'none' })
  },

  copyReport() {
    if (!this.data.analysis) return
    const item = this.data.analysis
    const text = `AI生成概率：${item.score}%\n风险：${item.riskLevel}\n字数：${item.wordCount}\n主要问题：${item.reasons.join('；')}`
    wx.setClipboardData({ data: text })
  },
})
