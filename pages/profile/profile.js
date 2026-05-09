const { readHistory } = require('../../utils/aiTextEngine')

Page({
  data: { total: 0, optimized: 0 },

  onShow() {
    this.setTabBarSelected(3)
    const list = readHistory()
    this.setData({ total: list.length, optimized: list.filter((item) => item.type === 'optimize').length })
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
