const { STORAGE_KEYS, runDetection, buildHistoryRecord, saveHistory } = require('../../utils/aiTextEngine')

const articleTypes = [
  { icon: '◎', name: '通用文本', nameShort: '通用文本' },
  { icon: '□', name: '论文/作业', nameShort: '论文/毕业' },
  { icon: '✎', name: '公众号文章', nameShort: '公众号' },
  { icon: '✦', name: '小红书笔记', nameShort: '小红书' },
  { icon: '◇', name: '知乎', nameShort: '知乎' },
  { icon: '▶', name: '口播脚本', nameShort: '口播' },
]

Page({
  data: {
    articleTypes,
    typeIndex: 0,
    articleText: '',
    maxLength: 10000,
    busy: false,
    showPrivacyForPaste: false,
    privacyContractName: '《用户隐私保护指引》',
  },

  onShow() {
    this.setTabBarSelected(0)
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
    if (typeof wx.getPrivacySetting !== 'function') {
      this.readClipboard()
      return
    }

    wx.getPrivacySetting({
      success: (res) => {
        if (res.privacyContractName) {
          this.setData({ privacyContractName: res.privacyContractName })
        }
        if (res.needAuthorization) {
          this.setData({ showPrivacyForPaste: true })
        } else {
          this.readClipboard()
        }
      },
      fail: () => this.readClipboard(),
    })
  },

  openPrivacyContract() {
    if (typeof wx.openPrivacyContract === 'function') {
      wx.openPrivacyContract({})
    }
  },

  cancelPrivacyForPaste() {
    this.setData({ showPrivacyForPaste: false })
  },

  onAgreePrivacyForPaste() {
    this.setData({ showPrivacyForPaste: false })
    this.readClipboard()
  },

  readClipboard() {
    wx.getClipboardData({
      success: (res) => {
        const text = (res.data || '').trim()
        if (!text) {
          wx.showToast({ title: '剪贴板为空', icon: 'none' })
          return
        }
        this.setData({
          articleText: text.slice(0, this.data.maxLength),
        })
        wx.showToast({ title: '已粘贴', icon: 'success' })
      },
      fail: (err) => {
        console.error('getClipboardData fail:', err)
        const errMsg = (err && err.errMsg) || ''
        const errno = err && err.errno

        if (errno === 112 || errMsg.indexOf('privacy agreement') >= 0) {
          this.setData({ showPrivacyForPaste: true })
          wx.showToast({ title: '请先在后台配置剪贴板隐私项', icon: 'none' })
          return
        }

        if (errno === 103 || errno === 104 || errMsg.indexOf('privacy') >= 0) {
          this.setData({ showPrivacyForPaste: true })
          wx.showToast({ title: '需同意隐私指引后才能粘贴', icon: 'none' })
          return
        }

        wx.showToast({
          title: '无法读取剪贴板，请长按输入框粘贴',
          icon: 'none',
          duration: 2500,
        })
      },
    })
  },

  detectText() {
    const text = this.data.articleText.trim()
    if (!text) {
      wx.showToast({ title: '请先输入文章', icon: 'none' })
      return
    }

    // 内容安全检测（阻塞式，通过审核必需）
    const doSecCheck = () => {
      return new Promise((resolve) => {
        if (typeof wx.msgSecCheck !== 'function') return resolve(true)
        wx.msgSecCheck({
          content: text.slice(0, 500),
          success: () => resolve(true),
          fail: () => {
            wx.showToast({ title: '内容包含违规信息', icon: 'none' })
            this.setData({ busy: false })
            resolve(false)
          },
        })
      })
    }

    doSecCheck().then((pass) => {
      if (!pass) return
      this.setData({ busy: true })
      const articleType = this.data.articleTypes[this.data.typeIndex].name

      runDetection(text, { articleType })
      .then((analysis) => {
        wx.setStorageSync(STORAGE_KEYS.currentAnalysis, analysis)
        saveHistory(buildHistoryRecord({
          type: 'detect',
          title: analysis.title,
          score: analysis.score,
          wordCount: analysis.wordCount,
          scene: articleType,
          analysis,
        }))
        this.setData({ busy: false })
        wx.navigateTo({ url: '/pages/result/result' })
      })
      .catch(() => {
        this.setData({ busy: false })
        wx.showToast({ title: '检测失败，请重试', icon: 'none' })
      })
    })
  },
})
