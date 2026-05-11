# 阅检AI助手 — 架构文档

> 版本：v1.0 | 作者：Architect Agent | 日期：2025-05-11

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────┐
│                  微信小程序                       │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│  │ 首页  │  │结果页│  │问题页│  │优化页│  ...  │
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘       │
│     │         │         │         │            │
│  ┌──┴─────────┴─────────┴─────────┴───┐        │
│  │          AI Text Engine            │  (前端引擎)│
│  │  analyzeArticle / humanizeArticle  │        │
│  └────────────────┬───────────────────┘        │
│                   │                            │
│  ┌────────────────┴───────────────────┐        │
│  │           Core Pipeline            │  (核心管道)│
│  │  pipeline / analysis / prompts     │        │
│  │  skills / strategies / quality     │        │
│  └────────────────┬───────────────────┘        │
│                   │                            │
│  ┌────────────────┴───────────────────┐        │
│  │         DeepSeek Client            │  (可选) │
│  └────────────────┬───────────────────┘        │
│                   │                            │
│        ┌──────────┴──────────┐                 │
│        │   wx Storage API    │                 │
│        └─────────────────────┘                 │
└─────────────────────────────────────────────────┘
           │
           ▼ (Phase 2)
┌─────────────────────────────────────────────────┐
│              Node.js Backend                    │
│  Express + PostgreSQL + Redis                   │
└─────────────────────────────────────────────────┘
```

## 2. 模块边界

### 2.1 分层原则

```
pages/          ← 页面层（仅数据传递，不含业务逻辑）
utils/          ← 引擎入口层（aiTextEngine, deepSeekClient）
core/           ← 核心业务层（所有检测/改写/优化逻辑）
tests/          ← 测试层
docs/           ← 文档层
prompts/        ← 提示词层（AI prompt 独立管理）
skills/         ← Hermes技能层（Agent开发规范）
agents/         ← Agent配置层
```

### 2.2 依赖方向

```
pages → utils (引擎入口) → core (业务逻辑)
pages ✗→ core (禁止直接引用core内部模块)
core ✗→ pages (禁止反向依赖)
```

**例外**：`utils/aiDetector.js` 是纯统计算法模块（无业务逻辑依赖），可作为独立模块被 `utils/aiTextEngine.js` 引用。

### 2.3 核心模块职责

| 模块 | 路径 | 职责 | 禁止行为 |
|------|------|------|----------|
| AI Text Engine | utils/aiTextEngine.js | 对外暴露 analyzeArticle / humanizeArticle 等 | 直接操作页面状态 |
| Rewrite Pipeline | core/pipeline/rewritePipeline.js | 逐句分析→策略映射→skill执行→去重→润色 | 调用页面 API 或 Storage |
| AI Pattern Analyzer | core/analysis/aiPatternAnalyzer.js | 句子级AI模式分析，输出 severity/type/direction | 修改文本 |
| Strategy Mapper | core/strategies/strategyMapper.js | 根据分析结果映射 skill 组合 | 直接调用 DeepSeek |
| Skills | core/skills/*.js | 单个去AI味的原子操作 | 跨 skill 状态污染 |
| Prompt Builder | core/prompts/*.js | 构建 DeepSeek API 消息 | 绕过外层直接调用 API |
| DeepSeek Client | utils/deepSeekClient.js | API 通信 + 配置管理 | 拼接 prompt（已解耦） |
| Rewrite Quality | core/quality/rewriteQuality.js | 改写质量评估 | 修改原文 |

## 3. 状态管理

### 3.1 当前策略

使用微信原生 `Page.data` 管理页面状态 + `wx.getStorageSync/setStorageSync` 做跨页面共享。

### 3.2 存储 key 命名

```js
STORAGE_KEYS = {
  currentAnalysis: 'ai_text_lab_current_analysis',      // 当前检测结果
  currentOptimize: 'ai_text_lab_current_optimize',       // 当前优化结果
  history: 'ai_text_lab_history',                        // 历史记录
  deepSeekConfig: 'ai_text_lab_deepseek_config',         // DeepSeek 配置
}
```

### 3.3 约束

- 跨页面数据传输**必须通过 wx.setStorageSync**，禁止全局变量
- 页面间跳转**禁止**通过 data-* 传大量文本数据
- 历史记录上限 30 条，超限自动裁剪

## 4. AI 功能 API 设计

### 4.1 检测

```js
analyzeArticle(text, options?: {
  title?: string
  articleType?: string
}) → AnalysisResult
```

### 4.2 改写

```js
humanizeArticle(text, options?: {
  intensity?: 'light' | 'medium' | 'deep'
  scene?: string
  articleType?: string
  referenceText?: string
  preserveStructure?: boolean
  preserveMeaning?: boolean
  forceChange?: boolean
}) → HumanizeResult

humanizeArticleAsync(text, options?) → HumanizeResult  // 优先 DeepSeek，回退本地
```

### 4.3 质量评估

```js
evaluateRewrite(original, rewritten, options?) → RewriteEvaluation
buildRewriteDiff(original, rewritten) → DiffBlock[]
```

## 5. Prompt 架构

### 5.1 原则

- 所有 prompt 存放在 `core/prompts/` 下独立文件
- 每个 prompt 文件对应一个能力
- 禁止在 DeepSeek Client 或页面层硬编码 prompt 文本
- Prompt 版本号记录在文件头注释中

### 5.2 Prompt 文件结构

```
core/prompts/
├── rewritePrompt.js      # 全文改写 prompt
├── polishPrompt.js       # 润色 prompt
└── analysisPrompt.js     # AI文本分析 prompt
```

### 5.3 版本标记

每个 prompt 文件头部必须包含：
```js
/**
 * @version 1.0
 * @updated 2025-05-11
 * @description 全文改写提示词
 */
```

## 6. Token 优化策略

### 6.1 当前

- 本地检测零 token 消耗
- DeepSeek 调用限制 max_tokens=4096（改写）/ 2048（分析）

### 6.2 未来

- 短文本（<300字）强制本地，不走云端
- DeepSeek 调用增加缓存层（通过重写文本 hash 键）

## 7. 开发规范

### 7.1 代码规范

- TypeScript 严格模式（Phase 2 引入）
- 禁止 `any`
- Hooks 优先（若引入 React）
- 函数式组件（若引入 React）
- TailwindCSS 原子类优先（若引入）

### 7.2 AI Agent 协作规范

```
PM Agent:
  ├── 输出 PRD 到 docs/prd/
  └── 输出页面流程到 docs/flow/

Architect Agent:
  ├── 维护 docs/architecture.md
  └── 决定模块边界和拆组件时机

Frontend Agent:
  ├── 只修改 pages/ 和部分 utils/
  └── 禁止修改 core/ 业务逻辑

Backend Agent:
  ├── 只修改后端代码（Phase 2）
  └── 禁止修改前端页面逻辑

Prompt Engineer Agent:
  ├── 只修改 core/prompts/
  └── 禁止修改 API 调用和页面逻辑

Review Agent:
  └── 输出 review-report.md

Refactor Agent:
  ├── 负责核心模块拆分
  └── 负责消除冗余逻辑
```

### 7.3 修改边界

任何 Agent 修改前必须判断：

1. 我的职责范围是什么？
2. 这次修改在哪个模块？
3. 是否跨模块边界？
4. 如果是跨模块，谁负责协调？

**跨模块修改必须通过 PM Agent 或 Architect Agent 协调。**

## 8. 后续架构演进路线

| Phase | 目标 | 涉及模块 |
|-------|------|----------|
| Phase 1 ✅ | 工程骨架 + 文档规范 | docs/, prompts/, skills/, agents/ |
| Phase 2 | 后端独立 | 新增 server/ 目录，迁移 DeepSeek 调用 |
| Phase 3 | TypeScript 迁移 | core/ → TypeScript |
| Phase 4 | PostgreSQL + 用户系统 | 后端扩展 |
| Phase 5 | Redis + 缓存优化 | 后端扩展 |
| Phase 6 | Taro 评估（按需） | 全项目 |

## 9. 关键决策记录 (ADR)

### ADR-001: 原生小程序优先，不急于 Taro

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
