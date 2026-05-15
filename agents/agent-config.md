# 阅检AI助手 — Agent 工作流配置

> 版本：v2.0 | 日期：2026-05-14

---

## 5 阶段工作流

每个阶段由一个独立的 Agent 执行，启动时只加载自己的 skill 文件，**不保留上游的原始对话上下文**。

```
用户需求
   │
   ▼
┌────────────────────────────────────────────────────────┐
│ Phase 1: PM Agent                                      │
│ Skill → skills/prd-writing.md                          │
│ 输出: docs/prd/PRD-v1.md                               │
│ 上下文: 仅读 skills/prd-writing.md + docs/prd/          │
└────────────────────┬───────────────────────────────────┘
                     │ PRD 文档
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: Architect Agent                               │
│ Skill → skills/architecture-design.md                  │
│ 输入: docs/prd/PRD-v1.md                               │
│ 输出: docs/architecture.md                             │
│ 上下文: 读 PRD + 现有架构 + 受影响的模块代码            │
└────────────────────┬───────────────────────────────────┘
                     │ 架构文档
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Frontend Agent                                │
│ Skill → skills/ui-development.md                       │
│ 输入: docs/architecture.md                             │
│ 输出: pages/, utils/ 代码                              │
│ 上下文: 读 PRD + 架构 + skills/development-workflow.md  │
└────────────────────┬───────────────────────────────────┘
                     │ 代码
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Review Agent                                  │
│ Skill → skills/code-review.md                          │
│ 输入: git diff 或文件变更列表                           │
│ 输出: 审查报告（文本输出，不写文件）                    │
│ 上下文: 读架构 + 变更文件 + development-workflow        │
└────────────────────┬───────────────────────────────────┘
                     │ 审查报告
                     ▼
┌────────────────────────────────────────────────────────┐
│ Phase 5: Test Agent                                    │
│ Skill → skills/testing.md                              │
│ 输入: 被测试模块的源代码                               │
│ 输出: tests/ 测试文件                                  │
│ 上下文: 读测试 skill + 被测试模块代码 + 架构           │
└────────────────────────────────────────────────────────┘
```

## 上下文隔离规则

| 规则 | 说明 |
|------|------|
| **单一 skill 加载** | 每个 Agent 启动时只加载自己的 skill 文件，不加载无关 skill |
| **最小文档读取** | 按上表规定的"输入"列读取，不多读 |
| **文档即契约** | Phase 1 的输出（PRD）是 Phase 2 的唯一输入；Phase 2 的输出（架构）是 Phase 3 的唯一输入 |
| **禁止读取非职责文件** | PM Agent 不读代码，Frontend Agent 不读测试文件，Review Agent 不修改代码 |
| **上限控制** | 单个 skill 文件不超过 80 行，架构文档不超过 150 行 |

## 启动命令

在 Claude Code 中启动各阶段的命令：

```bash
# Phase 1: 编写 PRD
> 按照 skills/prd-writing.md 的要求，与用户确认需求后编写 PRD

# Phase 2: 设计架构
> 按照 skills/architecture-design.md 的要求，基于 PRD 更新架构文档

# Phase 3: 开发页面
> 按照 skills/ui-development.md 的要求，基于架构文档实现代码

# Phase 4: 审查代码
> 按照 skills/code-review.md 的要求，审查变更

# Phase 5: 编写测试
> 按照 skills/testing.md 的要求，为模块编写测试
```

## 技能文件索引

| 文件 | 用途 |
|------|------|
| `skills/prd-writing.md` | PM Agent — 产品需求文档写作 |
| `skills/architecture-design.md` | Architect Agent — 架构文档设计 |
| `skills/ui-development.md` | Frontend Agent — UI 开发 |
| `skills/code-review.md` | Review Agent — 代码审查 |
| `skills/testing.md` | Test Agent — 测试编写 |
| `skills/development-workflow.md` | 通用开发流程规范 |
