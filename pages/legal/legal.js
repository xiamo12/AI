const LEGAL_CONTENT = {
  privacy: {
    title: '隐私政策',
    updatedAt: '2026-05-16',
    sections: [
      {
        heading: '1. 我们收集的信息',
        body: '阅检AI助手（以下简称「本小程序」）以本地检测为主。您输入的待检测文本仅在设备本地进行分析，不会上传至我们的服务器。\n\n在您使用「一键粘贴」时，我们会读取系统剪贴板内容，仅用于填入检测输入框，不会另作他用。',
      },
      {
        heading: '2. 本地存储',
        body: '检测历史记录、最近一次检测结果保存在您设备的小程序本地存储中（最多保留 30 条历史）。您可在「我的」页面清空历史记录。卸载或清除小程序数据后，上述信息将被删除。',
      },
      {
        heading: '3. 我们不会做的事',
        body: '当前版本不会将您的正文内容上传至第三方服务器，不会用于模型训练，不会在未经您同意的情况下向第三方出售或共享您的文本内容。',
      },
      {
        heading: '4. 权限说明',
        body: '剪贴板读取：用于「一键粘贴」功能，可在系统或微信隐私设置中管理相关授权。',
      },
      {
        heading: '5. 未成年人保护',
        body: '若您为未成年人，请在监护人指导下使用本小程序。',
      },
      {
        heading: '6. 政策更新',
        body: '我们可能适时更新本政策。重大变更将在小程序内提示。若后续版本启用云端检测，我们将在更新政策并征得必要同意后再上传文本。',
      },
      {
        heading: '7. 联系我们',
        body: '如对本政策有疑问，请通过小程序「我的」页面提供的反馈渠道与我们联系。',
      },
    ],
  },
  agreement: {
    title: '用户服务协议',
    updatedAt: '2026-05-16',
    sections: [
      {
        heading: '1. 服务说明',
        body: '本小程序提供基于本地规则的文本 AI 痕迹参考分析，帮助您识别文章中可能存在的模板化表达。检测结果仅供写作辅助参考，不构成学术鉴定、法律证据或任何权威判定。',
      },
      {
        heading: '2. 使用规范',
        body: '您应保证上传或粘贴的内容合法，不侵犯他人知识产权与隐私权。不得利用本小程序从事违法违规活动。',
      },
      {
        heading: '3. 结果免责声明',
        body: '受文本长度、体裁、改写程度等因素影响，检测分数可能存在误差。您应结合人工判断使用检测结果，我们不对因依赖检测结果而产生的任何损失承担责任。',
      },
      {
        heading: '4. 知识产权',
        body: '本小程序的软件、界面与检测规则归开发者所有。您保留对自己原文内容的所有权。',
      },
      {
        heading: '5. 服务变更',
        body: '我们有权对功能进行更新、调整或中止。若启用云端增强检测等联网功能，将另行告知并更新相关协议。',
      },
      {
        heading: '6. 协议更新',
        body: '继续使用本小程序即视为接受更新后的协议。若不同意，请停止使用并删除本地数据。',
      },
    ],
  },
}

Page({
  data: {
    title: '',
    updatedAt: '',
    sections: [],
  },

  onLoad(options) {
    const type = options.type === 'agreement' ? 'agreement' : 'privacy'
    const content = LEGAL_CONTENT[type]
    wx.setNavigationBarTitle({ title: content.title })
    this.setData({
      title: content.title,
      updatedAt: content.updatedAt,
      sections: content.sections,
    })
  },

  goBack() {
    wx.navigateBack()
  },
})
