const { STORAGE_KEYS, readHistory } = require('../../utils/aiTextEngine')

Page({
  data: {
    records: [],
  },

  onShow() {
    this.setTabBarSelected(1)
    const allRecords = readHistory()
    this.setData({ records: allRecords })
  },

  setTabBarSelected(index) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: index })
    }
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  openRecord(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record) return
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
          this.setData({ records: [] })
        }
      },
    })
  },
})
