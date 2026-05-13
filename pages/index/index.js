const { STORAGE_KEYS, analyzeArticle, buildHistoryRecord, saveHistory } = require('../../utils/aiTextEngine')

const articleTypes = [
  { icon: '◎', name: '通用文本', nameShort: '通用文本' },
  { icon: '□', name: '论文/作业', nameShort: '论文/毕业' },
  { icon: '✎', name: '公众号文章', nameShort: '公众号' },
  { icon: '✦', name: '小红书笔记', nameShort: '小红书' },
]

Page({
  data: {
    articleTypes,
    typeIndex: 0,
    articleText: '',
    maxLength: 10000,
    busy: false,
  },

  onShow() {
    this.setTabBarSelected(0)
    // 读取模板页传递的预设场景
    const presetScene = wx.getStorageSync('preset_scene')
    if (presetScene) {
      const idx = articleTypes.findIndex((t) => t.name === presetScene)
      if (idx >= 0) {
        this.setData({ typeIndex: idx })
      }
      wx.removeStorageSync('preset_scene')
    }
  },

  setTabBarSelected(index) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: index })
    }
  },

  onMore() {
    wx.showToast({ title: '更多功能开发中', icon: 'none' })
  },

  onMiniProgram() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  showMoreTypes() {
    wx.showToast({ title: '更多类型开发中', icon: 'none' })
  },

  selectType(event) {
    this.setData({ typeIndex: Number(event.currentTarget.dataset.index) })
  },

  onInput(event) {
    this.setData({ articleText: event.detail.value })
  },

  clearText() {
    this.setData({ articleText: '' })
  },

  pasteText() {
    wx.getClipboardData({
      success: (res) => this.setData({ articleText: res.data || '' }),
      fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' }),
    })
  },

  detectText() {
    const text = this.data.articleText.trim()
    if (!text) {
      wx.showToast({ title: '请先输入文章', icon: 'none' })
      return
    }
    this.setData({ busy: true })
    const articleType = this.data.articleTypes[this.data.typeIndex].name
    const analysis = analyzeArticle(text, { articleType })
    analysis.originalText = text
    wx.setStorageSync(STORAGE_KEYS.currentAnalysis, analysis)
    saveHistory(buildHistoryRecord({ type: 'detect', title: analysis.title, score: analysis.score, wordCount: analysis.wordCount, scene: articleType, analysis }))
    this.setData({ busy: false })
    wx.navigateTo({ url: '/pages/result/result' })
  },
})
