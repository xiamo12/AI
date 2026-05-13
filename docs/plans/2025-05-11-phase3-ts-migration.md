# Phase 3: TypeScript 迁移 — core/ 核心模块

> **目标**：将 `core/` 下 13 个 JS 模块安全迁移为 TypeScript，不加新功能、不改 API 签名。

**架构约束**：
- 每个模块独立迁移，不跨模块同步修改
- 迁移后 API 签名完全一致（CommonJS `module.exports` → 先用 JS 兼容导出）
- 不引入新依赖，仅安装 typescript + @types
- 迁移后运行已有测试确保无回归

---

## 任务分解

### Task 1: 安装 TypeScript 基础设施
**文件**：
- `package.json` — 添加 devDependencies
- `tsconfig.json` — 新创建

### Task 2: core/analysis/aiPatternAnalyzer → .ts
**文件**：
- `core/analysis/aiPatternAnalyzer.js` → 同名 `.ts`
- 类型定义：`AnalyzeResult`, `SentenceAnalysis`
- export 签名不变

### Task 3: core/skills/* (6 个模块) → .ts
**文件**：
- `antiTemplate.js`, `detailInjection.js`, `emotionalGrain.js`, `humanPause.js`, `observationRewrite.js`, `rhythmBreaker.js`
- 每个模块独立迁移
- 统一类型：`SkillApplyFn`, `SkillContext`

### Task 4: core/strategies/strategyMapper → .ts
**文件**：
- `strategyMapper.js`
- 依赖 Task 3（SKILL_REGISTRY 引用 skill 模块）

### Task 5: core/prompts/* (3 个模块) → .ts
**文件**：
- `analysisPrompt.js`, `polishPrompt.js`, `rewritePrompt.js`
- prompt 消息类型定义

### Task 6: core/quality/rewriteQuality → .ts
**文件**：
- `rewriteQuality.js`
- 依赖 Task 2（analyzeSentence 类型）

### Task 7: core/pipeline/rewritePipeline → .ts
**文件**：
- `rewritePipeline.js`（最大模块，444行）
- 依赖 Task 2-6 的全部类型

---

## Task-by-Task 执行序列

顺序按依赖关系：
```
Task 2 (analysis) ──→ Task 3 (skills)
                         │
                         ▼
                    Task 4 (strategies)
                         │
                    ┌────┴────┐
               Task 5 (prompts)  Task 6 (quality)
                         │
                         ▼
                    Task 7 (pipeline)
                         │
                    Task 8 (全量测试)
```
