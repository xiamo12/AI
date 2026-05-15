const { STORAGE_KEYS } = require('../../utils/aiTextEngine')

Page({
  data: { issues: [], filteredIssues: [], filter: 'all', filters: [], statusBarHeight: 0, loading: true },
  onShow() {
    this.setData({
      statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
      loading: true,
      filter: 'all', // 每次进入重置筛选，避免残留 filter 导致列表空白
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
    const hasConsistency = issues.some(item => item.type === 'consistency')
    const filters = [
      { key: 'all', name: '全部', count: issues.length },
      { key: 'high', name: '高频迹', count: issues.filter((item) => item.riskClass === 'high' && item.type !== 'consistency').length },
      { key: 'medium', name: '中等', count: issues.filter((item) => item.riskClass === 'medium' && item.type !== 'consistency').length },
      { key: 'low', name: '较低', count: issues.filter((item) => item.riskClass === 'low' && item.type !== 'consistency').length },
    ]
    if (hasConsistency) {
      filters.splice(1, 0, { key: 'consistency', name: '逻辑问题', count: issues.filter((item) => item.type === 'consistency').length })
    }
    let filteredIssues
    if (this.data.filter === 'all') {
      filteredIssues = issues
    } else if (this.data.filter === 'consistency') {
      filteredIssues = issues.filter((item) => item.type === 'consistency')
    } else {
      filteredIssues = issues.filter((item) => item.riskClass === this.data.filter && item.type !== 'consistency')
    }
    this.setData({ filters, filteredIssues })
  },
  changeFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.key }, () => this.refreshFilters())
  },
  goBack() { wx.navigateBack() },
  goHome() { wx.switchTab({ url: '/pages/index/index' }) },
})
