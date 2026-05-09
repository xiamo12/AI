const { STORAGE_KEYS, analyzeArticle, buildHistoryRecord, saveHistory, extractStyleProfile } = require('../../utils/aiTextEngine')

const articleTypes = [
  { name: '通用文本', icon: '◎' },
  { name: '公众号文章', icon: '✎' },
  { name: '小红书笔记', icon: '✦' },
  { name: '论文/作业', icon: '□' },
  { name: '职场文档', icon: '▣' },
  { name: '短视频脚本', icon: '▶' },
]

Page({
  data: {
    tabs: ['AI检测', '去痕改写'],
    activeTab: 'AI检测',
    articleTypes,
    typeIndex: 0,
    articleText: '',
    referenceText: '',
    styleProfile: null,
    maxLength: 10000,
    hasDetected: false,
    busy: false,
  },

  onShow() {
    this.setTabBarSelected(0)
  },

  setTabBarSelected(index) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: index })
    }
  },

  switchTab(event) {
    this.setData({ activeTab: event.currentTarget.dataset.tab })
  },

  toggleMode() {
    this.setData({ activeTab: this.data.activeTab === 'AI检测' ? '去痕改写' : 'AI检测' })
  },

  selectType(event) {
    this.setData({ typeIndex: Number(event.currentTarget.dataset.index) })
  },

  onInput(event) {
    this.setData({ articleText: event.detail.value, hasDetected: false })
  },

  onReferenceInput(event) {
    const referenceText = event.detail.value
    this.setData({ referenceText, styleProfile: extractStyleProfile(referenceText) })
  },

  clearText() {
    this.setData({ articleText: '', hasDetected: false })
  },

  clearReference() {
    this.setData({ referenceText: '', styleProfile: null })
  },

  pasteText() {
    wx.getClipboardData({
      success: (res) => this.setData({ articleText: res.data || '', hasDetected: false }),
      fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' }),
    })
  },

  useSample() {
    const sample = '真正优秀的人，都有长期主义。不是远离所有人，而是靠近真正值得的人。很多时候，我们需要意识到，成长不是一蹴而就的事情，而是在每一个选择里，慢慢找到自己的节奏。'
    this.setData({ articleText: sample, hasDetected: false })
  },

  runPrimaryAction() {
    const text = this.data.articleText.trim()
    if (!text) {
      wx.showToast({ title: '请先输入文章', icon: 'none' })
      return
    }
    this.setData({ busy: true })
    const articleType = this.data.articleTypes[this.data.typeIndex].name
    const analysis = analyzeArticle(text, { articleType })
    analysis.originalText = text
    analysis.referenceText = this.data.referenceText
    analysis.styleProfile = this.data.styleProfile
    wx.setStorageSync(STORAGE_KEYS.currentAnalysis, analysis)

    if (this.data.activeTab === 'AI检测') {
      saveHistory(buildHistoryRecord({ type: 'detect', title: analysis.title, score: analysis.score, wordCount: analysis.wordCount, scene: articleType, analysis }))
      this.setData({ busy: false, hasDetected: true })
      wx.navigateTo({ url: '/pages/result/result' })
      return
    }

    this.setData({ busy: false, hasDetected: true })
    wx.navigateTo({ url: '/pages/optimize-settings/optimize-settings' })
  },
})
