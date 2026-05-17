Page({
  data: {
    templates: [
      { icon: '✎', title: '公众号文章', desc: '观点清晰，段落有层次', scene: '公众号文章' },
      { icon: '✦', title: '小红书笔记', desc: '更口语，更有分享感', scene: '小红书笔记' },
      { icon: '□', title: '论文/作业', desc: '保持严谨，降低模板腔', scene: '论文/作业' },
      { icon: '▣', title: '职场文档', desc: '表达简洁，适合汇报', scene: '职场文档' },
      { icon: '▶', title: '口播脚本', desc: '短句更多，节奏更顺', scene: '口播脚本' },
    ],
    selectedScene: '',
  },

  onShow() {
    this.setTabBarSelected(2)
    // 从首页读取预选场景
    const presetScene = wx.getStorageSync('current_scene')
    if (presetScene) {
      this.setData({ selectedScene: presetScene })
      wx.removeStorageSync('current_scene')
    }
  },

  selectTemplate(event) {
    const scene = event.currentTarget.dataset.scene
    if (!scene) return
    wx.switchTab({ url: '/pages/index/index' })
    // 通过 storage 传递预选场景，首页 onShow 时读取
    wx.setStorageSync('preset_scene', scene)
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
