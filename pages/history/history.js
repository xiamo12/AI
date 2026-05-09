const { STORAGE_KEYS, readHistory } = require('../../utils/aiTextEngine')

Page({
  data: {
    tab: 'all',
    allRecords: [],
    records: [],
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'detect', name: '检测记录' },
      { key: 'optimize', name: '优化记录' },
    ],
  },

  onShow() {
    this.setTabBarSelected(1)
    const allRecords = readHistory()
    this.setData({ allRecords }, () => this.filterRecords())
  },

  setTabBarSelected(index) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: index })
    }
  },

  switchTab(event) {
    this.setData({ tab: event.currentTarget.dataset.key }, () => this.filterRecords())
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  filterRecords() {
    const records = this.data.tab === 'all' ? this.data.allRecords : this.data.allRecords.filter((item) => item.type === this.data.tab)
    this.setData({ records })
  },

  openRecord(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record) return
    if (record.type === 'optimize' && record.optimize) {
      wx.setStorageSync(STORAGE_KEYS.currentOptimize, record.optimize)
      wx.navigateTo({ url: '/pages/optimize-result/optimize-result' })
      return
    }
    if (record.analysis) {
      wx.setStorageSync(STORAGE_KEYS.currentAnalysis, record.analysis)
      wx.navigateTo({ url: '/pages/result/result' })
    }
  },

  clearHistory() {
    wx.showModal({
      title: '清空历史记录',
      content: '确定要清空本地历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync(STORAGE_KEYS.history, [])
          this.setData({ allRecords: [], records: [] })
        }
      },
    })
  },
})
