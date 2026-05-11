const observationRewrite = require('../skills/observationRewrite')
const antiTemplate = require('../skills/antiTemplate')
const detailInjection = require('../skills/detailInjection')
const emotionalGrain = require('../skills/emotionalGrain')
const humanPause = require('../skills/humanPause')
const rhythmBreaker = require('../skills/rhythmBreaker')

const SKILL_REGISTRY = {
  observationRewrite,
  antiTemplate,
  detailInjection,
  emotionalGrain,
  humanPause,
  rhythmBreaker,
}

const STRATEGY_MAP = {
  template_expression: ['observationRewrite', 'antiTemplate', 'rhythmBreaker'],
  over_summary: ['observationRewrite', 'detailInjection'],
  too_abstract: ['antiTemplate', 'detailInjection', 'observationRewrite'],
  too_regular: ['rhythmBreaker', 'humanPause'],
  lack_detail: ['antiTemplate', 'detailInjection', 'humanPause'],
  weak_human_voice: ['humanPause', 'observationRewrite'],
  emotion_flat: ['emotionalGrain', 'humanPause'],
  no_real_resistance: ['emotionalGrain', 'detailInjection'],
}

/**
 * 根据分析结果选择 skill。
 *
 * Strategy Mapper 是“问题类型”和“表达策略”的连接层。
 * 后续如果要增加新策略，只需要注册 skill 并扩展 STRATEGY_MAP。
 */
function mapStrategies(analysis = {}, context = {}) {
  const names = STRATEGY_MAP[analysis.problem_type] || ['rhythmBreaker']
  const intensity = context.intensity || 'medium'
  const limit = intensity === 'light' ? 1 : intensity === 'deep' ? names.length : Math.min(2, names.length)
  return names.slice(0, limit).map((name) => SKILL_REGISTRY[name]).filter(Boolean)
}

module.exports = {
  SKILL_REGISTRY,
  STRATEGY_MAP,
  mapStrategies,
}
