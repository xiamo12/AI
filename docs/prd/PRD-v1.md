# 阅检AI助手 — 产品需求文档（PRD）

> 版本：v1.0 | 作者：PM Agent | 日期：2025-05-11

---

## 1. 产品定位

「阅检AI助手」是一个微信小程序，面向写作者、内容创作者、学生和职场人士，提供以下核心能力：

- **AI率检测** — 分析文本的AI生成概率，定位具体问题句子
- **AI味优化** — 将AI痕迹重的文本改写为更自然的真人表达
- **多场景适配** — 公众号、小红书、论文、职场、口播等场景优化
- **原文对比** — 改写前后逐句 diff 对比视图

## 2. 用户画像

| 画像 | 痛点 | 使用场景 |
|------|------|----------|
| 内容创作者 | 文章被检出AI率高，需要去痕 | 公众号投稿前检测+改写 |
| 学生 | 论文/作业怕被判定AI代写 | 提交前自查+润色 |
| 职场人士 | 报告/邮件显得"太AI" | 工作文档去模板化 |
| 普通写作者 | 文字缺少真人感 | 日常写作优化 |

## 3. 核心功能

### F1: AI率检测

检测维度：
- 本地引擎分析（统计特征 + 句式指纹 + 语义分布）
- DeepSeek 云端分析（可选，需配置 API Key）
- 混合评分（字数越长，云端权重越高）

输出：
- 整体 AI 率评分（0-96）
- 置信度（较短/中等/较高）
- 段落级风险标注
- 句子级问题列表（按风险排序）
- AI 味来源分析（命中哪些句式指纹）

### F2: AI文本改写

改写模式：
- **本地管道**（默认）— 逐句分析→策略映射→6大skill应用→跨句去重→润色
- **DeepSeek云端**（可选）— 调用大模型改写

改写强度：
- 轻度（light）— 只处理明显AI味
- 中度（medium）— 允许重组句子
- 深度（deep）— 允许重排语序和段落节奏

场景适配：
- 通用文本 / 公众号文章 / 小红书笔记 / 论文作业 / 职场文档 / 短视频脚本

### F3: 原文对比

- 改写前后逐段对比
- 句子级 diff 标注
- 改写质量评估（AI率变化、语句通顺度、风格匹配度）

### F4: 历史记录

- 检测/改写记录查阅
- 最多保留 30 条
- 本地存储（wx.getStorageSync）

### F5: 会员系统（规划中）

- 免费额度
- 付费解锁更多次数/DeepSeek API 支持

### F6: 写作模板

- 常见写作框架模板展示
- 模板参考引用（待完善）

## 4. 页面清单

| # | 页面 | 路由 | 类型 | 功能 |
|---|------|------|------|------|
| P1 | 首页 | pages/index/index | 主入口 | 文本输入、类型选择、检测/改写启动 |
| P2 | 检测结果 | pages/result/result | 结果页 | AI评分、风险等级、段落分析、来源分析 |
| P3 | 问题句子 | pages/issues/issues | 列表页 | 按风险列出问题句子及改写建议 |
| P4 | 优化设置 | pages/optimize-settings/optimize-settings | 配置页 | 改写强度、场景、参考风格设置 |
| P5 | 优化结果 | pages/optimize-result/optimize-result | 结果页 | 改写前后对比(diff)，质量评估 |
| P6 | 历史记录 | pages/history/history | TabBar | 检测/改写记录 |
| P7 | 模板 | pages/templates/templates | TabBar | 写作模板展示 |
| P8 | 个人中心 | pages/profile/profile | TabBar | 用户统计、配置 |
| P9 | 日志 | pages/logs/logs | 辅助 | 启动日志 |

## 5. 页面流程

```
首页 ──[检测]──→ 检测结果 ──[查看问题]──→ 问题句子
  │                       └──[去改写]──→ 优化设置 ──→ 优化结果
  │
  └──[改写]──→ 优化设置 ──→ 优化结果

TabBar: 首页 | 记录 | 模板 | 我的
```

## 6. 数据流

```
用户输入 → normalizeText() → analyzeArticle()
  ├── localDetector.detectLocal() (统计+语义)
  ├── aiFlavorPatterns 匹配 (句式指纹)
  ├── 评分加权 → classifyRisk()
  └── 结果存储到 wx.setStorageSync → 跳转结果页

改写:
用户输入 → humanizeArticle()
  └── rewritePipeline.rewriteArticle()
       ├── 逐句 analyzeSentence()
       ├── mapStrategies() → skill.apply()
       ├── dedupConsecutivePrefixes()
       ├── dedupIdenticalPatterns()
       ├── smoothTransitions()
       └── finalPolish()
```

## 7. 非功能需求

- 检测响应 < 2s（纯本地）
- 改写响应 < 1s（本地管道）
- 支持最大 10,000 字符输入
- 所有数据本地存储，无云端同步
- DeepSeek API key 仅存本地 storage

## 8. 后续迭代方向

- [ ] 后端独立（Node.js + PostgreSQL）
- [ ] 用户系统（微信登录 + 会员）
- [ ] DeepSeek 调用迁移至后端
- [ ] Redis 缓存层
- [ ] 多端支持（Taro 评估）
- [ ] 团队协作空间
