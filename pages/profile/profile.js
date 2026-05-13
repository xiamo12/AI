const { STORAGE_KEYS, readHistory } = require('../../utils/aiTextEngine')

Page({
  data: {
    total: 0,
  },

  onShow() {
    this.setTabBarSelected(3)
    const list = readHistory()
    this.setData({
      total: list.length,
    })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  setTabBarSelected(index) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: index })
    }
  },
})
