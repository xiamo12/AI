# 阅检AI助手 — Hermes 开发规范

> 版本：v1.0 | 日期：2025-05-11

---

## 1. 开发前必读

在开始任何开发任务前，按顺序加载：

1. `docs/architecture.md` — 理解模块边界
2. `docs/prd/PRD-v1.md` — 理解功能范围
3. 对应 `core/` 模块文件 — 理解现有实现

## 2. 模块边界规则

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  pages/  │ ──→ │ utils/   │ ──→ │  core/   │
│ (UI层)   │     │ (引擎入口)│     │ (业务层) │
└──────────┘     └──────────┘     └──────────┘
```

**绝对禁止**：
- `pages/` 直接 `require('../core/...')`
- `core/` 模块引用 `wx.*` API
- 在 `core/` 模块中调用 `require('../utils/...')`

## 3. 任务粒度

每个任务 ≤ 200 行代码。超过必须拆分子任务。

## 4. 修改流程

```
1. 读 architecture.md（确认模块边界）
2. 读对应模块文件（理解现有逻辑）
3. 判断影响范围（不影响无关模块）
4. 修改代码
5. 运行测试
6. 更新 MEMORY.md / 更新 skills
```

## 5. 组件拆分解耦

当函数/页面/wxml 超过 200 行时：
- 提取子组件到新文件
- 提取 hooks/helper 到独立文件
- 禁止在 Page() 构造函数中写超过 100 行的逻辑

## 6. 命名约定

- 文件：kebab-case（如 `rewrite-pipeline.js`）
- 函数：camelCase（如 `analyzeArticle()`）
- 常量：UPPER_SNAKE_CASE（如 `STORAGE_KEYS`）
- 模块导出：统一使用 `module.exports = { ... }`

## 7. 测试要求

- `core/` 模块必须有单元测试
- 测试文件放模块目录下的 `__tests__/`
- 测试名称格式：`test_[function_name]`
- 每次修改后必须运行相关测试

## 8. AI Prompt 管理

- 所有 AI prompt 在 `core/prompts/` 下管理
- 每个 prompt 文件头标注版本号和日期
- 修改 prompt 必须同步更新版本号
- 禁止在业务逻辑代码中直接拼接 prompt 文本

## 9. 错误处理

- 所有 API 调用必须有 error handling
- 错误信息用中文
- 回退策略：DeepSeek 失败 → 本地引擎 → 返回原文

## 10. 提交规范

```
type: 简要描述

type 可选：feat / fix / refactor / docs / test / chore
```

## 11. 内存管理

当单次对话超过 30 轮时：
1. 执行 `git add . && git commit -m "checkpoint: ..."`
2. 更新 `memory/MEMORY.md` 记录关键决策
3. 用清晰的任务描述开始新一轮对话
