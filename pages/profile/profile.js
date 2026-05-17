const { readHistory, clearHistory } = require('../../utils/aiTextEngine')

Page({
  data: {
    total: 0,
  },

  onShow() {
    this.setTabBarSelected(2)
    const list = readHistory()
    this.setData({ total: list.length })
  },

  goLegal(event) {
    const type = event.currentTarget.dataset.type || 'privacy'
    wx.navigateTo({ url: `/pages/legal/legal?type=${type}` })
  },

  goHistory() {
    wx.switchTab({ url: '/pages/history/history' })
  },

  onClearHistory() {
    wx.showModal({
      title: '清空历史记录',
      content: '将删除本机全部检测历史与最近一次结果，且无法恢复。是否继续？',
      confirmColor: '#6D5CFF',
      success: (res) => {
        if (!res.confirm) return
        clearHistory()
        this.setData({ total: 0 })
        wx.showToast({ title: '已清空', icon: 'success' })
      },
    })
  },

  setTabBarSelected(index) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: index })
    }
  },
})
