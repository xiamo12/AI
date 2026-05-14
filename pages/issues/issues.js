const { STORAGE_KEYS } = require('../../utils/aiTextEngine')

Page({
  data: { issues: [], filteredIssues: [], filter: 'all', filters: [], statusBarHeight: 0, loading: true },
  onShow() {
    this.setData({
      statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
      loading: true,
    })
    const analysis = wx.getStorageSync(STORAGE_KEYS.currentAnalysis)
    const issues = analysis && analysis.issues ? analysis.issues : []
    this.setData({ issues }, () => this.refreshFilters())
    this.setData({ loading: false })
    this._setTabBarSelected(0)
  },

  _setTabBarSelected(index) {
    const tabBar = this.selectComponent('#tab-bar')
    tabBar && tabBar.setData({ selected: index })
  },
  refreshFilters() {
    const issues = this.data.issues
    const filters = [
      { key: 'all', name: '全部', count: issues.length },
      { key: 'high', name: '高频迹', count: issues.filter((item) => item.riskClass === 'high').length },
      { key: 'medium', name: '中等', count: issues.filter((item) => item.riskClass === 'medium').length },
      { key: 'low', name: '较低', count: issues.filter((item) => item.riskClass === 'low').length },
    ]
    const filteredIssues = this.data.filter === 'all' ? issues : issues.filter((item) => item.riskClass === this.data.filter)
    this.setData({ filters, filteredIssues })
  },
  changeFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.key }, () => this.refreshFilters())
  },
  goBack() { wx.navigateBack() },
  goHome() { wx.switchTab({ url: '/pages/index/index' }) },
})
