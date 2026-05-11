/**
 * DeepSeek API 客户端。
 *
 * 职责：
 * 1. DeepSeek 配置管理与存储
 * 2. API 请求/响应处理
 * 3. 调用 prompt 模块构造消息
 *
 * 提示词逻辑已迁至 core/prompts/，本模块仅做 API 通信和配置管理。
 */

const { buildRewriteMessages } = require('../core/prompts/rewritePrompt')
const { buildPolishMessages } = require('../core/prompts/polishPrompt')
const { buildAnalysisMessages } = require('../core/prompts/analysisPrompt')

const DEFAULT_CONFIG = {
  enabled: false,
  apiKey: '',
  endpoint: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
}

function getWx() {
  return typeof wx !== 'undefined' ? wx : null
}

function mergeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    endpoint: config.endpoint || DEFAULT_CONFIG.endpoint,
    model: config.model || DEFAULT_CONFIG.model,
  }
}

/**
 * 从本地 storage 读取 DeepSeek 配置。
 */
function readDeepSeekConfig(storageKey) {
  const wxApi = getWx()
  if (!wxApi || !storageKey) return { ...DEFAULT_CONFIG }
  return mergeConfig(wxApi.getStorageSync(storageKey) || {})
}

function saveDeepSeekConfig(storageKey, config) {
  const wxApi = getWx()
  if (!wxApi || !storageKey) return
  wxApi.setStorageSync(storageKey, mergeConfig(config))
}

function maskApiKey(apiKey) {
  const value = String(apiKey || '')
  if (!value) return ''
  if (value.length <= 10) return '已配置'
  return `${value.slice(0, 5)}****${value.slice(-4)}`
}

function stripCodeFence(text) {
  return String(text || '')
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```$/g, '')
    .trim()
}

/**
 * 通用对话补全请求。
 * @param {Array<{role, content}>} messages
 * @param {object} config
 * @param {object} [overrides] - 额外请求参数覆盖，如 { temperature }
 * @returns {Promise<string>} 返回纯文本
 */
function requestChatCompletion(messages, config = {}, overrides = {}) {
  const wxApi = getWx()
  const finalConfig = mergeConfig(config)
  if (!wxApi || !wxApi.request) return Promise.reject(new Error('wx.request unavailable'))
  if (!finalConfig.apiKey) return Promise.reject(new Error('DeepSeek API Key missing'))

  return new Promise((resolve, reject) => {
    wxApi.request({
      url: finalConfig.endpoint,
      method: 'POST',
      timeout: 60000,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${finalConfig.apiKey}`,
      },
      data: {
        model: finalConfig.model,
        messages,
        stream: false,
        temperature: overrides.temperature != null ? overrides.temperature : 0.78,
        top_p: 0.9,
        max_tokens: overrides.maxTokens || 4096,
      },
      success(response) {
        const status = response.statusCode || 0
        if (status < 200 || status >= 300) {
          reject(new Error(`DeepSeek request failed: ${status}`))
          return
        }
        const content =
          response.data &&
          response.data.choices &&
          response.data.choices[0] &&
          response.data.choices[0].message &&
          response.data.choices[0].message.content
        if (!content) {
          reject(new Error('DeepSeek empty response'))
          return
        }
        resolve(stripCodeFence(content))
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

/**
 * 全文改写（DeepSeek 版）。
 * 提示词构造委托给 core/prompts/rewritePrompt.js
 */
function rewriteArticleWithDeepSeek(text, options = {}, config = {}) {
  const messages = buildRewriteMessages(text, options)
  return requestChatCompletion(messages, config)
}

/**
 * 全文润色（DeepSeek 版）。
 * 用于改写管道 finalPolish 阶段的云端可选步骤。
 * 提示词构造委托给 core/prompts/polishPrompt.js
 */
function polishArticleWithDeepSeek(article, options = {}, config = {}) {
  const messages = buildPolishMessages(article, options)
  return requestChatCompletion(messages, config, {
    temperature: 0.72, // 润色需要更稳，温度略低
    maxTokens: 4096,
  })
}

/**
 * AI 文本分析（DeepSeek 版）。
 * 用于云端分析作为本地分析引擎的补充或替代。
 * 提示词构造委托给 core/prompts/analysisPrompt.js
 */
function analyzeArticleWithDeepSeek(text, options = {}, config = {}) {
  const messages = buildAnalysisMessages(text, options)
  return requestChatCompletion(messages, config, {
    temperature: 0.7,
    maxTokens: 2048,
  })
}

module.exports = {
  DEFAULT_CONFIG,
  readDeepSeekConfig,
  saveDeepSeekConfig,
  maskApiKey,
  buildRewriteMessages, // 保留导出以保持兼容
  rewriteArticleWithDeepSeek,
  polishArticleWithDeepSeek,
  analyzeArticleWithDeepSeek,
}
