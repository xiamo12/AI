# 阅检AI助手 — Agent 配置与职责

> 版本：v1.0 | 日期：2025-05-11

---

## 1. Agent 职责矩阵

| Agent | 文档输入 | 文档输出 | 工作目录 | 修改范围 |
|-------|---------|---------|---------|---------|
| PM | 用户需求 | PRD，页面流程 | docs/prd/, docs/flow/ | 仅文档 |
| Architect | PRD | 架构设计，ADR | docs/architecture.md | 仅架构文档 |
| Frontend | PRD + 架构 | 页面代码 | pages/ | 页面层 + wxml/wxss |
| Backend | PRD + 架构 | API代码 | server/ (Phase 2) | 后端代码 |
| Prompt Engineer | 架构 | Prompt文件 | core/prompts/ | prompt 文件 |
| Review | 所有 | review-report.md | — | 仅产生报告 |
| Test | 模块代码 | 测试文件 | core/*/__tests__/ | 测试文件 |
| Refactor | 模块代码 | 重构后代码 | core/ | 核心模块 |

## 2. Agent 通信规则

```
PM ──→ Architect ──→ Frontend
                  └──→ Backend
                  └──→ Prompt Engineer
                         └──→ Test
Review ──→ (所有 Agent)
Refactor ──→ (定期触发)
```

- 下游 Agent 依赖上游 Agent 的产出
- 同层 Agent（Frontend / Backend / Prompt Engineer）可并行
- Review Agent 在所有开发完成后执行
- Refactor Agent 独立周期触发，不依赖其他 Agent

## 3. Agent 启动检查清单

每个 Agent 启动时检查：

- [ ] 是否读取了 architecture.md？
- [ ] 是否读取了 PRD？
- [ ] 修改范围是否在自己的职责内？
- [ ] 是否读取了目标模块的现有代码？
- [ ] 是否加载了 skills/development-workflow.md？

## 4. 跨 Agent 协作示例

### 场景：新增一个检测维度

1. PM Agent：更新 PRD → 新增检测维度说明
2. Architect Agent：评估模块边界，决定放入哪个 core/ 模块
3. Prompt Engineer Agent：如果涉及 AI 分析，新增 prompt
4. Frontend Agent：在检测结果页展示新维度
5. Test Agent：为新增逻辑编写测试
6. Review Agent：review 所有变更

### 场景：修改提示词

1. Prompt Engineer Agent：修改 core/prompts/ 下对应文件
2. 更新文件头版本号
3. Test Agent：验证 prompt 输出符合预期
4. Review Agent：review prompt 质量

## 5. Context 保护规则

- 单次任务不扫描超过 5 个文件
- 读文件从 `architecture.md` 开始，而非全项目
- 超过 500 行文件只读关键区段
- 优先读取 skills/ 中的工作流规范
