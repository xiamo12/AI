Page({
  data: {
    templates: [
      { icon: '✎', title: '公众号文章', desc: '观点清晰，段落有层次' },
      { icon: '✦', title: '小红书笔记', desc: '更口语，更有分享感' },
      { icon: '□', title: '论文/作业', desc: '保持严谨，降低模板腔' },
      { icon: '▣', title: '职场文档', desc: '表达简洁，适合汇报' },
      { icon: '▶', title: '口播脚本', desc: '短句更多，节奏更顺' },
    ],
  },

  onShow() {
    this.setTabBarSelected(2)
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
