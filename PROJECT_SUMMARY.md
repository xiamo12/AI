# 阅检AI助手 — 项目概要

## 项目简介
微信小程序「阅检AI助手」，提供 AI 文本检测和去痕改写功能。

## 技术栈
- 微信原生小程序
- Node.js API
- DeepSeek API

## 模块
1. **AI率检测** — 分析文本的AI生成概率
2. **AI文本重写** — 去痕改写，保留原意
3. **用户历史记录** — 检测/改写记录查阅
4. **会员系统** — 付费解锁更多功能

## 页面结构
| 页面 | 路由 | 功能 |
|------|------|------|
| 首页（AI检测） | pages/index/index | 输入文本，选择类型，执行检测或改写 |
| 检测结果 | pages/result/result | AI检测评分、风险等级、问题句子 |
| 问题句子 | pages/issues/issues | 按风险等级列出问题句子及改写建议 |
| 优化设置 | pages/optimize-settings/optimize-settings | 改写强度/场景/风格参考设置 |
| 优化结果 | pages/optimize-result/optimize-result | 改写前后对比（diff视图） |
| 历史记录 | pages/history/history | 检测/改写记录查阅（TabBar） |
| 模板 | pages/templates/templates | 写作模板展示（TabBar） |
| 个人中心 | pages/profile/profile | 用户统计信息（TabBar） |
| 日志 | pages/logs/logs | 小程序启动日志 |

## 核心模块

### AI检测引擎（utils/aiDetector.js + utils/aiTextEngine.js）
- **aiDetector.js** — 纯JS本地的AI文本检测算法（统计特征+语义相似度分析），无需网络
- **aiTextEngine.js** — 主逻辑：analyzeArticle()/humanizeArticle()/evaluateRewrite()/buildRewriteDiff()

### 数据流
用户输入文本 → analyzeArticle() → wx.setStorageSync(STORAGE_KEYS.currentAnalysis 共享) → navigateTo 结果页

### 改写逻辑
humanizeArticle() → 场景适配 + 词语替换 + 句式调整 → ensureChanged() 确保实质性变更

## UI 风格
- 主色：#075f73
- 背景：#f7f9fb
- 自定义 TabBar：custom-tab-bar/

## 当前开发方向
（在此处添加你当前要改的功能或要修复的问题）
