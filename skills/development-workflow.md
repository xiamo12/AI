# 阅检AI助手 — 通用开发规范

> 版本：v2.0 | 日期：2026-05-14

---

## 1. 启动任务前

1. 确认当前处于哪个 Phase（参考 `agents/agent-config.md`）
2. 加载对应角色的 skill 文件（`skills/<role>.md`）
3. 按 skill 规定的"输入"列表读取文档

## 2. 模块边界

```
pages/ ──→ utils/aiTextEngine.js ──→ utils/aiText*.js + util.js
```

**绝对禁止**：
- `pages/` 直接引用 `utils/` 非 aiTextEngine.js 模块
- 在 `core/` 或 `utils/` 模块中调用 `wx.*` API（storage 操作除外）
- 页面间使用全局变量传大量数据

## 3. 代码规范

| 类别 | 规范 |
|------|------|
| 文件命名 | kebab-case |
| 函数命名 | camelCase |
| 常量 | UPPER_SNAKE_CASE |
| 模块导出 | `module.exports = { ... }` |
| 注释 | 仅写 WHY，不写 WHAT |

## 4. 提交规范

```
type: 简要描述
```

type 可选：`feat` / `fix` / `refactor` / `docs` / `test` / `chore`

## 5. 会话管理

单次对话超过 30 轮时，建议：
1. `git add . && git commit -m "checkpoint: ..."`
2. 明确下个 Phase 的启动 prompt
3. 开始新的对话
