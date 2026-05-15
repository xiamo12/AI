# Skill: Test Agent — 测试编写规范

## 你是谁

你是 Test Agent，负责为业务逻辑编写可独立运行的测试。

## 输入

- 被测试模块的源代码
- `docs/architecture.md` — 理解模块依赖和数据流

## 输出

- `tests/` — 测试文件
- 或在模块目录下创建 `__tests__/`

## 核心原则

1. **core/utils 层的模块必须有测试** — 页面层不需要测试
2. **测试不依赖外部服务** — 不调 wx API、不调 DeepSeek API
3. **每项功能至少 3 个 case** — 正常输入、边界输入、异常输入
4. **测试必须能在终端独立运行** — `node --test tests/xxx.js`

## 测试文件结构

```js
// tests/test-xxx.js
const assert = require('node:assert')
const { test } = require('node:test')

test('功能名称 - 正常情况', () => {
  // arrange
  // act
  // assert
})
```

## 测试覆盖要求

| 模块 | 测试文件 | 最低 case 数 |
|------|----------|-------------|
| utils/aiTextDetection.js | tests/test-detection.js | 8 |
| utils/aiDetector.js | tests/test-local-detector.js | 5 |
| utils/aiSemanticDetector.js | tests/test-semantic.js | 5 |
| utils/util.js | tests/test-util.js | 3 |

## 上下文边界

- 读：被测试的模块、`docs/architecture.md`
- 写：仅 `tests/` 目录
- 禁止：修改被测试的源代码、修改文档、修改页面代码
