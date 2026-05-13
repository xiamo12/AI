const { STORAGE_KEYS, analyzeArticle, buildHistoryRecord, saveHistory } = require('../../utils/aiTextEngine')

const SCALE_LABELS = [
  { label: '高痕迹', key: 'high' },
  { label: '较明显', key: 'apparent' },
  { label: '一般', key: 'medium' },
  { label: '较低', key: 'low' },
  { label: '很低', key: 'lowest' },
]

Page({
  data: {
    analysis: null,
    displayIssues: [],
    canViewIssues: false,
    riskLabel: 'AI痕迹明显',
    statusBarHeight: 0,
    loading: true,
    indicatorLeft: '50%',
    scaleLabels: SCALE_LABELS,
  },

  onShow() {
    const sysInfo = wx.getSystemInfoSync()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      loading: true,
    })
    const analysis = wx.getStorageSync(STORAGE_KEYS.currentAnalysis)
    if (analysis) {
      this._initWithAnalysis(analysis)
    }
    this.setData({ loading: false })
  },

  _initWithAnalysis(analysis) {
    if (analysis.sourceAnalysis && analysis.sourceAnalysis.length && (!analysis.issues || !analysis.issues.length) && analysis.text) {
      const refreshed = analyzeArticle(analysis.text, { articleType: analysis.articleType })
      analysis = {
        ...refreshed,
        originalText: analysis.originalText || analysis.text,
      }
      wx.setStorageSync(STORAGE_KEYS.currentAnalysis, analysis)
    }

    const score = Number(analysis.score || 0)
    const issueCount = analysis.issues && analysis.issues.length ? analysis.issues.length : 0
    const riskText = analysis.riskText || '一般'

    const labelMap = {
      '极高频': 'AI痕迹明显', '高频': 'AI痕迹较明显', '严重': 'AI痕迹一般',
      '一般': 'AI痕迹一般',
      '较低': 'AI痕迹较低',
      '极低': 'AI痕迹极低',
    }
    const riskLabel = labelMap[riskText] || 'AI痕迹一般'

    const sourceList = analysis.sourceAnalysis || []
    const displayIssues = sourceList.map((item, idx) => {
      const bgColorMap = { high: '#FFF0ED', medium: '#FFFBEB', low: '#F0FDF4' }
      const levelMap = { high: '高', medium: '中', low: '低' }
      return {
        ...item,
        bgColor: bgColorMap[item.riskClass] || '#F0FDF4',
        level: levelMap[item.riskClass] || '低',
        levelClass: item.riskClass || 'low',
      }
    })

    this.setData({
      analysis,
      displayIssues,
      riskLabel,
      canViewIssues: issueCount > 0,
      indicatorLeft: Math.min(Math.max(score, 2), 98) + '%',
      scaleLabels: this._computeActiveLabels(score),
    })
  },

  _computeActiveLabels(score) {
    let activeIndex
    if (score >= 80) activeIndex = 0
    else if (score >= 60) activeIndex = 1
    else if (score >= 40) activeIndex = 2
    else if (score >= 20) activeIndex = 3
    else activeIndex = 4
    return SCALE_LABELS.map((item, i) => ({
      ...item,
      active: i === activeIndex,
    }))
  },

  recheck() {
    if (!this.data.analysis) return
    wx.showLoading({ title: '重新检测中…', mask: true })
    const analysis = analyzeArticle(this.data.analysis.text, { articleType: this.data.analysis.articleType })
    analysis.originalText = this.data.analysis.originalText || this.data.analysis.text
    wx.setStorageSync(STORAGE_KEYS.currentAnalysis, analysis)
    saveHistory(buildHistoryRecord({
      type: 'detect', title: analysis.title, score: analysis.score,
      wordCount: analysis.wordCount, scene: analysis.articleType, analysis,
    }))

    this._initWithAnalysis(analysis)
    wx.hideLoading()
    wx.showToast({ title: '已重新检测', icon: 'none' })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  goIssues() {
    if (!this.data.canViewIssues) {
      wx.showToast({ title: '暂无可查看的问题句子', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/issues/issues' })
  },

  copyReport() {
    if (!this.data.analysis) return
    const item = this.data.analysis
    const text = `AI生成概率：${item.score}%\n风险：${item.riskLevel}\n字数：${item.wordCount}\n主要问题：${(item.reasons || []).join('；')}`
    wx.setClipboardData({ data: text })
  },
})
