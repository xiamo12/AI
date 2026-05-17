Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '⌂' },
      { pagePath: '/pages/history/history', text: '记录', icon: '▤' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '♙' },
    ],
  },

  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      const path = event.currentTarget.dataset.path
      if (index === this.data.selected) return
      wx.switchTab({ url: path })
    },
  },
})
