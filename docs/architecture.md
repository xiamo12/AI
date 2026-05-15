# 阅检AI助手 — 架构文档

> 版本：v2.0 | 作者：Architect Agent | 日期：2026-05-14

---

## 项目概览

阅检AI助手是一个微信小程序，核心功能为 **AI 率本地检测**。无后端依赖，所有检测逻辑在客户端本地运行。

| 维度 | 说明 |
|------|------|
| 技术栈 | 微信原生小程序 + JavaScript |
| 运行时 | 纯本地（无服务端依赖） |
| 核心引擎 | `utils/aiTextDetection.js` — AI 句式指纹匹配 + `utils/aiDetector.js` — 统计特征分析 + `utils/aiSemanticDetector.js` — 语义级检测 |
| 状态管理 | `wx.setStorageSync` / `wx.getStorageSync`，无全局变量 |

## 目录结构

```
miniprogram/
├── pages/                           # 页面层（6页）
│   ├── index/                       # 首页：文本输入 + 检测启动
│   ├── result/                      # 检测结果：AI评分环形展示
│   ├── issues/                      # 问题句子列表（按风险排序）
│   ├── history/                     # 历史记录（TabBar 第二项）
│   ├── templates/                   # 写作模板（TabBar 第三项）
│   └── profile/                     # 个人中心（TabBar 第四项）
│
├── utils/                           # 引擎层
│   ├── aiTextEngine.js             # 统一入口（重新导出各模块）
│   ├── aiTextDetection.js          # AI率检测主逻辑（句式指纹+评分+分级）
│   ├── aiDetector.js               # 本地统计特征检测算法
│   ├── aiSemanticDetector.js       # 语义级检测（困惑度/过渡平滑/词汇多样性）
│   ├── aiSemanticConsistency.js    # v2.0 上下文语义一致性检测（段落断层/逻辑跳跃）
│   ├── aiTextHistory.js            # 历史记录管理
│   └── util.js                     # 通用工具（文本归一化/分句/数值处理）
│
├── custom-tab-bar/                  # 自定义 TabBar 组件（Unicode 图标）
├── assets/tab/                      # TabBar 图标 PNG（框架要求，未渲染）
├── tests/                           # 测试文件
├── docs/                            # 产品/架构文档
│   ├── prd/PRD-v1.md
│   ├── flow/user-journey.md
│   └── architecture.md
├── skills/                          # Agent 开发规范（按角色分文件）
├── agents/agent-config.md          # Agent 工作流配置
└── prompts/                         # AI Prompt 文件
```

## 依赖方向

```
pages/ ──→ utils/aiTextEngine.js ──→ utils/aiText*.js + util.js
pages/ ✗──→ 直接引用 utils/ 内部模块
utils/  ✗──→ 引用 wx.* API（aiTextHistory.js 除外，需读写 storage）
```

## 核心数据流

```
用户输入文本
    │
    ▼
normalizeText() ──→ splitParagraphs() / splitSentences()
    │
    ├──→ collectPatternHits()     ── 正则句式 + 模板词 + 场景权重
    ├──→ localDetector.detectLocal()  ── 句长/虚词/n-gram/多样性
    ├──→ analyzeSemantic()        ── 困惑度/过渡平滑/词汇多样性
    ├──→ analyzeConsistency()     ── v2.0 语义一致性（断层/矛盾/重复）
    └──→ 混合评分 → classifyRisk() → 写入 wx.setStorageSync
```

## 状态管理

```js
STORAGE_KEYS = {
  currentAnalysis: 'ai_text_lab_current_analysis',  // 当前检测结果
  history: 'ai_text_lab_history',                    // 历史记录（上限30条）
}
```

跨页面数据传输通过 `wx.setStorageSync`，禁止通过 `data-*` 传大量文本。

## v2.0 新增模块

### utils/aiSemanticConsistency.js

段落级语义一致性检测，输出三类异常：

| 类型 | 检测方法 | 说明 |
|------|----------|------|
| 语义断层 | 相邻段落关键名词向量交集 < 阈值 | 段落间话题跳跃无过渡 |
| 观点矛盾 | 对立词对（如"应该/不应该"）跨段出现 | 前后观点不一致 |
| 论据重复 | 跨段 n-gram 重复率 > 阈值 | 同一论点多段重复表述 |

### 场景检测权重（aiTextDetection.js）

场景检测权重由 `articleType` 决定：
- `论文/作业` — 学术模板词 + 引用句式权重 +2
- `公众号文章` — 营销收束句 + 情绪模板权重 +2
- `小红书笔记` — 感叹体 + 排比结构权重 +2
- `通用文本` — 默认权重

## 核心模块 API

### utils/aiTextEngine.js（唯一入口）

| 函数 | 说明 |
|------|------|
| `analyzeArticle(text, options?)` | 检测文本 AI 率，返回 AnalysisResult |
| `buildHistoryRecord(payload)` | 构建历史记录对象 |
| `readHistory()` | 读取历史记录 |
| `saveHistory(record)` | 保存历史记录 |

### AnalysisResult 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| score | number | AI 率评分（0-96） |
| riskLevel | string | 风险等级文本 |
| riskClass | 'high'|'medium'|'low' | 风险分类 |
| wordCount | number | 字数 |
| paragraphCount | number | 段落数 |
| aiFlavorDetails | Array | 句式指纹详情 |
| sourceAnalysis | Array | Top 5 AI 味来源 |
| paragraphs | Array | 段落级分析 |
| issues | Array | 句子级问题列表 |
| semanticConsistency | Object | v2.0 语义一致性分析（段落断层/观点矛盾/论据重复） |
| reasons | Array | 检测结论文字 |

## 页面路由

| 页面 | 路由 | tabBar 索引 | 功能 |
|------|------|-------------|------|
| 首页 | pages/index/index | 0 | 文本输入、检测启动 |
| 检测结果 | pages/result/result | — | AI评分展示、段落分析 |
| 问题句子 | pages/issues/issues | — | 问题句子列表 |
| 历史记录 | pages/history/history | 1 | 检测记录查阅 |
| 模板 | pages/templates/templates | 2 | 写作模板选择 |
| 个人中心 | pages/profile/profile | 3 | 用户统计信息 |

## 页面导航流

```
首页 ──[检测]──→ 检测结果 ──[查看问题]──→ 问题句子
TabBar: 首页 | 记录 | 模板 | 我的
```
