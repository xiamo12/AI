# 阅检AI助手 — 架构文档

> 版本：v1.1 | 作者：Architect Agent | 日期：2025-05-11

---

# 项目结构

```
miniprogram/                         # 微信小程序根目录
│
├── docs/                            # 文档层
│   ├── prd/PRD-v1.md               # 产品需求文档
│   ├── flow/user-journey.md        # 页面流程与用户旅程
│   └── architecture.md             # 架构文档（本文件）
│
├── pages/                           # 页面层（9页）
│   ├── index/                       # 首页：文本输入/检测/改写启动
│   ├── result/                      # 检测结果：AI评分/段落分析
│   ├── issues/                      # 问题句子列表
│   ├── optimize-settings/           # 优化设置：强度/场景
│   ├── optimize-result/             # 优化结果：diff对比/质量评估
│   ├── history/                     # 历史记录（TabBar）
│   ├── templates/                   # 写作模板（TabBar）
│   ├── profile/                     # 个人中心（TabBar）
│   └── logs/                        # 启动日志
│
├── custom-tab-bar/                  # 自定义 TabBar 组件
│
├── utils/                           # 引擎入口层
│   ├── aiTextEngine.js             # 引擎主入口（analyzeArticle/humanizeArticle/evaluateRewrite）
│   ├── deepSeekClient.js           # DeepSeek API 通信 + 配置管理
│   ├── aiDetector.js               # 本地统计+语义检测算法
│   └── util.js                     # 通用工具
│
├── core/                            # 核心业务层（TypeScript + JS 双入口）
│   ├── types.ts                     # 共享类型定义
│   ├── analysis/
│   │   └── aiPatternAnalyzer.ts    # 句子级 AI 模式分析
│   ├── pipeline/
│   │   ├── rewritePipeline.ts      # 改写管线（逐句→策略→skill→去重→润色）
│   │   └── __tests__/              # 管线单元测试
│   ├── prompts/
│   │   ├── rewritePrompt.ts        # 全文改写 prompt 构造器
│   │   ├── polishPrompt.ts         # 润色 prompt 构造器
│   │   └── analysisPrompt.ts       # AI分析 prompt 构造器
│   ├── skills/                     # 6个去AI味的原子技能
│   │   ├── antiTemplate.ts         # 模板词替换
│   │   ├── detailInjection.ts      # 细节注入
│   │   ├── emotionalGrain.ts       # 情绪颗粒度
│   │   ├── humanPause.ts           # 人类停顿感
│   │   ├── observationRewrite.ts   # 观察改写
│   │   └── rhythmBreaker.ts        # 节奏打散
│   ├── strategies/
│   │   └── strategyMapper.ts       # 问题类型 → skill 组合映射
│   └── quality/
│       └── rewriteQuality.ts       # 改写质量 S/A/B/C/D 评估
│
├── tests/                           # 测试层
│   ├── test-detection.js           # 检测测试（8 cases）
│   ├── test-rewrite.js             # 改写测试（13 cases）
│   └── test-quality.js             # 质量评估测试（16 cases）
│
├── assets/                          # 静态资源
│   └── tab/                         # TabBar 图标
│
├── prompts/                         # AI prompt 独立目录（已就绪）
├── skills/                          # Hermes Agent 开发规范
│   └── development-workflow.md
├── agents/                          # Agent 配置与职责
│   └── agent-config.md
│
├── app.js                           # 小程序入口
├── app.json                         # 全局配置（9页+TabBar）
├── app.wxss                         # 全局样式
├── project.config.json              # 微信开发者配置
├── project.private.config.json      # 私有配置
├── package.json                     # npm 工程化
├── tsconfig.json                    # TypeScript 严格模式配置
├── .gitignore
└── sitemap.json
```

---

# 模块关系

## 分层原则

```
pages/          ← 页面层（仅数据传递，不含业务逻辑）
utils/          ← 引擎入口层（对外暴露 analyzeArticle/humanizeArticle）
core/           ← 核心业务层（所有检测/改写/优化逻辑）
tests/          ← 测试层
docs/           ← 文档层
```

## 依赖方向（唯一合法路径）

```
pages ──→ utils (引擎入口) ──→ core (业务逻辑)
pages ✗──→ core (禁止直接引用 core 内部模块)
core  ✗──→ pages (禁止反向依赖)
core  ✗──→ wx.* API (core 必须是可独立测试的纯逻辑层)
core  ✗──→ require('../utils/...') (core 不引用上层模块)
```

## 模块职责矩阵

| 模块 | 路径 | 职责 | 禁止行为 |
|------|------|------|----------|
| AI Text Engine | `utils/aiTextEngine.js` | 对外暴露 `analyzeArticle` / `humanizeArticle` / `buildRewriteDiff` 等 | 直接操作页面状态或 WXML |
| DeepSeek Client | `utils/deepSeekClient.js` | API 通信、配置读写、API Key 脱敏展示 | 拼接 prompt 文本 |
| AI Detector | `utils/aiDetector.js` | 本地统计特征+语义相似度检测算法 | 依赖 wx API |
| Rewrite Pipeline | `core/pipeline/rewritePipeline.ts` | 逐句分析→策略映射→skill 执行→跨句去重→最终润色 | 调用 wx Storage 或页面 API |
| AI Pattern Analyzer | `core/analysis/aiPatternAnalyzer.ts` | 单句 AI 味来源分析，输出 problem_type/severity/direction | 修改文本内容 |
| Strategy Mapper | `core/strategies/strategyMapper.ts` | 根据 problem_type 映射 skill 组合 | 直接调用 DeepSeek |
| Skills (x6) | `core/skills/*.ts` | 单个去 AI 味的原子文本操作 | 跨 skill 状态污染、依赖其他 skill |
| Prompt Builder | `core/prompts/*.ts` | 构建 DeepSeek API 请求消息数组 | 绕过外层直接发起 HTTP 请求 |
| Rewrite Quality | `core/quality/rewriteQuality.ts` | 改写质量 S/A/B/C/D 等级自动评估 | 修改原文或改写结果 |

## 核心模块调用链

```
analyzeArticle(text)
  └─ localDetector.detectLocal()     # 统计+语义分布
  └─ collectPatternHits()             # 句式指纹匹配
  └─ classifyRisk()                   # 评分分级
  └─ buildIssues()                    # 生成问题句子列表

humanizeArticle(text)
  └─ rewritePipeline.rewriteArticle()
       ├── splitParagraphs/splitIntoSentences
       ├── analyzeSentence()          # 每句 AI 味分析
       ├── mapStrategies()            # 问题 → skill 映射
       ├── skills[N].apply()          # 执行技能链
       ├── hasSubstantiveChange()     # 确保实质变更
       ├── fallbackRewrite()          # 未变更时强制改写
       ├── dedupConsecutivePrefixes() # B1 前缀去重
       ├── dedupIdenticalPatterns()   # B1 句式雷同检测
       ├── smoothTransitions()        # B2 跨句平滑
       └── finalPolish()              # 场景适配 + 参考风格
```

---

# API 规范

## 引擎入口 API（utils/aiTextEngine.js）

### 检测

```js
analyzeArticle(text, options?: {
  title?: string
  articleType?: string
}) → AnalysisResult
```

**AnalysisResult 结构**：
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 `analysis_{timestamp}` |
| text | string | 归一化后原文 |
| score | number | AI 率评分（0-96） |
| riskLevel | string | 风险等级文本 |
| riskClass | 'high' | 'medium' | 'low' | 风险分类 |
| wordCount | number | 字数 |
| paragraphCount | number | 段落数 |
| sentenceCount | number | 句子数 |
| aiFlavorHits | number | AI 味句式总命中次数 |
| aiFlavorDetails | Array | 句式指纹详情（label/count/type/weight） |
| sourceAnalysis | Array | Top 5 AI 味来源（title/desc/count/riskClass） |
| paragraphs | Array | 段落级分析（score/risk/reasons/suggestion） |
| issues | Array | 句子级问题列表（按风险排序） |
| highRiskSentences | Array | 高风险句子（Top 8） |
| reasons | Array | 检测结论文字 |
| confidence | string | 置信度：较低/中等/较高 |
| probability | number | 与 score 一致 |

### 改写

```js
humanizeArticle(text, options?: {
  intensity?: 'light' | 'medium' | 'deep'
  scene?: string
  articleType?: string
  referenceText?: string
  preserveStructure?: boolean
  preserveMeaning?: boolean
  forceChange?: boolean
}) → { text: string, styleProfile: object|null, pipelineReport: ArticleRewriteResult }

humanizeArticleAsync(text, options?) → Promise<HumanizeResult>
  // 优先调用 DeepSeek，失败回退到 humanizeArticle
```

### 质量评估与对比

```js
evaluateRewrite(original, rewritten, options?) → {
  before: AnalysisResult         // 原文分析
  after: AnalysisResult          // 改写后分析
  summary: string                // "AI率 X% → Y%，降低 Z%"
  items: Array<{                 // 3项评估卡片
    label, status, displayValue, detail
  }>
}

buildRewriteDiff(original, rewritten) → DiffBlock[]
  // DiffBlock: { index, before, after, changed, fragments[] }
  // fragment: { id, before, after, changed }
```

### 历史记录

```js
buildHistoryRecord(payload) → HistoryRecord
readHistory() → HistoryRecord[]
saveHistory(record) → void
```

## DeepSeek API（utils/deepSeekClient.js）

| 函数 | 参数 | 返回 |
|------|------|------|
| `rewriteArticleWithDeepSeek(text, options, config)` | text + 改写选项 + API配置 | Promise\<string\> |
| `polishArticleWithDeepSeek(article, options, config)` | article + 场景 + API配置 | Promise\<string\> |
| `analyzeArticleWithDeepSeek(text, options, config)` | text + 分析选项 + API配置 | Promise\<string\> |
| `readDeepSeekConfig(storageKey)` | storageKey | DeepSeekConfig |
| `saveDeepSeekConfig(storageKey, config)` | storageKey + config | void |
| `maskApiKey(apiKey)` | raw key | 脱敏字符串 |

**核心约束**：
- 所有 prompt 构造委托给 `core/prompts/*.ts`，本模块**只做 API 通信**
- 默认 temperature: 改写 0.78 / 润色 0.72 / 分析 0.7
- 超时 60s，max_tokens 4096（改写）/ 2048（分析）

---

# Prompt 系统

## 架构原则

1. **所有 prompt 在独立文件中管理** — 禁止在任何业务代码中硬编码 prompt 文本
2. **每个文件对应一种能力** — 改写/润色/分析各一个文件
3. **版本化** — 每个文件头标注 `@version` + `@updated`
4. **返回纯文本** — 所有 prompt 要求模型返回不含 Markdown 的纯正文

## 文件结构

```
core/prompts/
├── rewritePrompt.ts      # 全文改写 prompt（5条正面 + 5条负面约束）
├── polishPrompt.ts       # 最终润色 prompt（5条润色原则）
└── analysisPrompt.ts     # AI 文本分析 prompt（8类问题类型）
```

## Prompt 版本标记规范

每个 prompt 文件头部必须包含：
```ts
// ============================================================
// [功能名称] 提示词构造器
//
// @version 1.1
// @updated 2025-05-11
// ============================================================
```

## Prompt 能力总览

| Prompt文件 | 角色 | 核心指令 | 输出格式 |
|-----------|------|---------|---------|
| rewritePrompt | 中文资深编辑 | 有阻力感/具体落脚点/长短句/真实情绪/不总结 | 纯正文 |
| polishPrompt | 中文资深编辑 | 句式微调/去机翻感/削语气词/去收束句 | 纯正文 |
| analysisPrompt | AI文本检测专家 | 检测8类问题类型 + JSON格式输出 | JSON |

## 调用链

```
页面层 ──→ deepSeekClient.rewriteArticleWithDeepSeek()
                 └─→ buildRewriteMessages(text, options)
                        └─→ 构造 [{role:'system',content}, {role:'user',content}]
                             └─→ requestChatCompletion(messages, config)
                                    └─→ wx.request → DeepSeek API
```

## 禁止行为

- 在 `deepSeekClient.js` 中直接拼接 prompt 字符串（已解耦，切勿回归）
- 在页面层直接写 prompt 文本
- 修改 prompt 后不同步更新版本号

---

# 状态管理

## 当前架构（原生小程序，无状态管理库）

### 页面级状态

微信原生 `Page.data` — 每个页面独立管理自己的 UI 状态。

### 跨页面共享状态

通过 `wx.setStorageSync` / `wx.getStorageSync` 传递，**严禁使用全局变量**（`getApp().globalData`）。

### 存储 key 命名规范

```js
STORAGE_KEYS = {
  currentAnalysis: 'ai_text_lab_current_analysis',        // 当前检测结果
  currentOptimize: 'ai_text_lab_current_optimize',         // 当前优化结果
  history: 'ai_text_lab_history',                          // 历史记录（上限30条）
  deepSeekConfig: 'ai_text_lab_deepseek_config',           // DeepSeek 配置
}
```

### 状态流转

```
首页 ──[检测]──→ wx.setStorageSync(currentAnalysis) ──→ 检测结果页
首页 ──[优化]──→ 优化设置页 ──→ wx.setStorageSync(currentOptimize) ──→ 优化结果页
检测结果 ──[改写]──→ 优化设置页
```

### 约束

1. 跨页面数据传输**必须通过 wx.setStorageSync**
2. 页面间跳转**禁止**通过 `data-*` 传大量文本数据
3. 历史记录上限 30 条，超限自动裁剪
4. 每次检测/改写后自动保存到历史记录

### 未来演进（Phase 2+）

```
Phase 2: 引入后端后，存储迁移到服务端
Phase 4: 引入 PostgreSQL 持久化 + 用户隔离
Phase 5: Redis 缓存热点检测结果
```

---

# 数据流

## 检测数据流

```
用户输入文本
    │
    ▼
normalizeText() ── 文本归一化（去多余空格/换行）
    │
    ├──► splitParagraphs() ── 按换行拆段落
    │       │
    │       └──► collectPatternHits(段落) ── 句式指纹匹配
    │               ├── aiFlavorPatterns (18种正则)
    │               ├── templatePhrases (27个模板词)
    │               └── countParallelismHits (排比检测)
    │
    ├──► classifyRisk(rawScore) ── 评分→等级映射（6级）
    │
    ├──► splitSentences() ── 按句末标点拆句子
    │       │
    │       └──► buildIssues() ── 句子级问题分析
    │               ├── 每句 collectPatternHits
    │               ├── 句长异常检测
    │               └── classifyRisk → 排序
    │
    ├──► 统计指标计算
    │       ├── averageSentenceLength
    │       ├── sentenceVariance (方差不对称度)
    │       ├── uniqueRatio (字符多样性)
    │       ├── concreteHits (具体数据/引用)
    │       └── humanSignalHits (人称/停顿词)
    │
    └──► localDetector.detectLocal() ── 本地统计+语义模型
            │
            └──► 混合评分 (blendWeight按字数动态)
                    │
                    ▼
              最终 score = clamp(0-96)
                    │
                    ▼
              写入 wx.setStorageSync(currentAnalysis)
                    │
                    ▼
              页面跳转 → pages/result/result
```

## 改写数据流

```
用户输入文本 + 改写设置（强度/场景/参考风格）
    │
    ▼
humanizeArticle() / humanizeArticleAsync()
    │
    ├──► [Async分支] 尝试 DeepSeek 云端改写
    │       ├── buildRewriteMessages() → 构造 prompt
    │       ├── requestChatCompletion() → 调用 API
    │       └── 成功？→ 返回结果 / 失败？→ 回退本地
    │
    └──► [Local分支] rewritePipeline.rewriteArticle()
            │
            ├── 1. 逐句分析
            │       ├── splitParagraphs / splitIntoSentences
            │       └── analyzeSentence() → problem_type + severity
            │
            ├── 2. 策略映射
            │       └── mapStrategies(problem_type) → Skill[]
            │             ├── A2 去重：检查原句是否含 skill 标记词
            │             └── 过滤已用 skill
            │
            ├── 3. Skill 执行链
            │       └── skills.forEach(s.apply())
            │             ├── antiTemplate → 模板词替换
            │             ├── humanPause → 插入停顿词
            │             ├── emotionalGrain → 补入情绪
            │             ├── detailInjection → 补入场景细节
            │             ├── observationRewrite → 观点→观察
            │             └── rhythmBreaker → 打散整齐节奏
            │
            ├── 4. 实质变更检查
            │       ├── hasSubstantiveChange()
            │       └── 无变更 → fallbackRewrite() → ensureChanged()
            │
            ├── 5. B1 跨句去重
            │       ├── dedupConsecutivePrefixes() — 连续句式前缀去重
            │       └── dedupIdenticalPatterns() — 句式雷同检测
            │
            ├── 6. B2 跨句平滑
            │       ├── smoothTransitions()
            │       │     ├── 双前缀拼接修复 (first,second, → first,)
            │       │     ├── 重复标点修复 (。。→ 。)
            │       │     └── 跨句连接词冗余
            │       └── 参考风格 / 场景适配
            │
            └── 7. finalPolish
                    ├── removeMechanicalArtifacts
                    ├── applySceneTone (口播/论文/职场)
                    └── applyReferenceStyle (参考文风段落节奏)
```

## 历史记录数据流

```
检测/改写完成
    │
    ▼
buildHistoryRecord({ type, title, score, wordCount, ... })
    │
    ▼
readHistory() → [existing...]
    │
    ▼
saveHistory([new, ...existing].slice(0, 30))
    │
    ▼
写入 wx.setStorageSync(history)
```

---

# 页面流

## 页面路由映射

| 页面 | 路由 | 类型 | 功能 |
|------|------|------|------|
| 首页 | `pages/index/index` | 主入口 + TabBar | 文本输入、类型选择、AI检测/去痕改写启动 |
| 检测结果 | `pages/result/result` | 结果页（navigateTo） | AI评分环形展示、段落风险分布、来源分析 |
| 问题句子 | `pages/issues/issues` | 列表页（navigateTo） | 按风险排序问题句子、改写建议 |
| 优化设置 | `pages/optimize-settings/optimize-settings` | 配置页（navigateTo） | 强度/场景/参考文风设置 |
| 优化结果 | `pages/optimize-result/optimize-result` | 结果页（navigateTo） | 改前改后 diff 对比、质量评估 |
| 历史记录 | `pages/history/history` | TabBar | 检测/改写记录列表 |
| 模板 | `pages/templates/templates` | TabBar | 写作模板展示（待完善） |
| 个人中心 | `pages/profile/profile` | TabBar | 用户统计信息、DeepSeek配置 |
| 日志 | `pages/logs/logs` | 辅助 | 启动日志 |

## TabBar 结构

```
┌────────────┬────────────┬────────────┬────────────┐
│   首页     │   记录     │   模板     │   我的     │
│ (index)    │ (history)  │ (templates)│ (profile)  │
└────────────┴────────────┴────────────┴────────────┘
```

## 首页 Tab 切换

首页内部有两个 Tab：「AI检测」和「去痕改写」
- 切换保留已输入文本
- 按钮文案随 Tab 变化
- 检测/改写的输入区域和选项共享

## 页面导航流

```
                         ┌────────────────┐
                         │   首页 (index) │
                         │  ┌──┬──┐      │
                         │  │检测│改写│   │
                         │  └──┴──┘      │
                         └──┬─────┬──────┘
                            │     │
                 ┌──────────▼┐   ┌▼───────────────┐
                 │ 检测结果   │   │ 优化设置        │
                 │ (result)  │   │ (optimize-      │
                 │           │   │  settings)      │
                 └──┬────┬───┘   └───────┬────────┘
                    │    │               │
              ┌─────▼┐ ┌─▼──────────┐   │
              │问题句 │ │ 优化设置    │   │
              │(issues)│ │(跳转改写)  │   │
              └───────┘ └────────────┘   │
                                    ┌────▼────────┐
                                    │ 优化结果     │
                                    │(optimize-   │
                                    │ result)     │
                                    └─────────────┘
```

## 导航数据传递

| 来源页 | 动作 | 目标页 | 数据传递方式 |
|--------|------|--------|-------------|
| 首页 | 点击「AI检测」 | 检测结果 | `STORAGE_KEYS.currentAnalysis` |
| 首页 | 点击「去痕改写」 | 优化设置 | 文本通过全局变量传递 |
| 检测结果 | 点击「问题句子」 | 问题句子 | 从 `STORAGE_KEYS.currentAnalysis` 读取 |
| 检测结果 | 点击「去改写」 | 优化设置 | `navigateTo` |
| 优化设置 | 点击「开始优化」 | 优化结果 | `STORAGE_KEYS.currentOptimize` |
| 所有页 | 返回 | 上一页 | `navigateBack` |

## 用户场景流

### 场景 A：学生检测论文
1. 首页 → 选择"论文/作业" → 粘贴文本 → 点击「AI检测」
2. 查看评分 + 段落风险 + 来源分析
3. 进入问题句子页 → 查看具体问题
4. 点击「去改写」→ 选择"深度"强度 → 优化
5. 在优化结果页对比改前改后

### 场景 B：作者日常写作优化
1. 首页 → 切到「去痕改写」Tab
2. 粘贴草稿 + 选择"公众号"场景 + 提供参考风格文本
3. 点击「去痕改写」→ 等待分析
4. 查看质量评估百分比变化
5. 复制改写结果

### 场景 C：历史回溯
1. TabBar「记录」→ 列表展示最近记录
2. 点击记录 → 重新查看检测结果或优化结果
3. 可基于历史记录再次优化

---

# 附录：演进路线

| Phase | 目标 | 涉及模块 |
|-------|------|----------|
| Phase 1 ✅ | 工程骨架 + 文档规范 | docs/, prompts/, skills/, agents/ |
| Phase 3 ✅ | TypeScript 迁移 core/ | core/ → TypeScript |
| Phase 2 | 后端独立 + DeepSeek 迁移 | 新增 server/，迁移 API 调用 |
| Phase 4 | PostgreSQL + 用户系统 | 后端扩展 |
| Phase 5 | Redis + 缓存优化 | 后端扩展 |
| Phase 6 | Taro 评估（按需） | 全项目 |

# 附录：关键决策记录 (ADR)

### ADR-001: 原生小程序优先
**背景**：项目当前为微信原生小程序，无多端需求。
**决策**：保持原生，等出现跨端需求时再评估 Taro。
**理由**：原生性能更优，开发效率更高，无需引入额外桥接层。

### ADR-002: core/ 为可独立测试的业务层
**背景**：检测/改写逻辑与页面层耦合度高。
**决策**：core/ 模块不依赖 wx API，所有数据通过参数传入、结果通过返回值传出。
**理由**：方便单元测试，方便未来迁移到 Node.js 后端或 Taro。

### ADR-003: aiTextEngine.js 为唯一引擎入口
**背景**：页面直接引用 core/ 或 utils/aiDetector 导致耦合。
**决策**：页面只能 import `utils/aiTextEngine`，所有引擎功能通过该文件暴露。
**理由**：统一入口便于后续重构、缓存、日志注入。
