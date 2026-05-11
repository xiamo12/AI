const { STORAGE_KEYS, readHistory, deepSeekClient } = require('../../utils/aiTextEngine')

Page({
  data: {
    total: 0,
    optimized: 0,
    deepSeekEnabled: false,
    deepSeekKey: '',
    deepSeekKeyMasked: '',
    deepSeekModel: 'deepseek-chat',
    deepSeekModels: ['deepseek-chat', 'deepseek-reasoner'],
  },

  onShow() {
    this.setTabBarSelected(3)
    const list = readHistory()
    const config = deepSeekClient.readDeepSeekConfig(STORAGE_KEYS.deepSeekConfig)
    this.setData({
      total: list.length,
      optimized: list.filter((item) => item.type === 'optimize').length,
      deepSeekEnabled: !!config.enabled,
      deepSeekKey: config.apiKey || '',
      deepSeekKeyMasked: deepSeekClient.maskApiKey(config.apiKey),
      deepSeekModel: config.model || 'deepseek-chat',
    })
  },

  toggleDeepSeek(event) {
    this.setData({ deepSeekEnabled: event.detail.value })
  },

  inputDeepSeekKey(event) {
    this.setData({ deepSeekKey: event.detail.value })
  },

  selectDeepSeekModel(event) {
    this.setData({ deepSeekModel: this.data.deepSeekModels[Number(event.detail.value || 0)] })
  },

  saveDeepSeekConfig() {
    deepSeekClient.saveDeepSeekConfig(STORAGE_KEYS.deepSeekConfig, {
      enabled: this.data.deepSeekEnabled,
      apiKey: this.data.deepSeekKey,
      model: this.data.deepSeekModel,
    })
    this.setData({ deepSeekKeyMasked: deepSeekClient.maskApiKey(this.data.deepSeekKey) })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  clearDeepSeekConfig() {
    deepSeekClient.saveDeepSeekConfig(STORAGE_KEYS.deepSeekConfig, {
      enabled: false,
      apiKey: '',
      model: 'deepseek-chat',
    })
    this.setData({
      deepSeekEnabled: false,
      deepSeekKey: '',
      deepSeekKeyMasked: '',
      deepSeekModel: 'deepseek-chat',
    })
    wx.showToast({ title: '已清除', icon: 'none' })
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
