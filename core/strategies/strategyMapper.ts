// ============================================================
// Strategy Mapper — 根据分析结果映射 skill 组合
// ============================================================

import type { Skill, SkillContext, SentenceAnalysis } from '../types'

import observationRewrite from '../skills/observationRewrite'
import antiTemplate from '../skills/antiTemplate'
import detailInjection from '../skills/detailInjection'
import emotionalGrain from '../skills/emotionalGrain'
import humanPause from '../skills/humanPause'
import rhythmBreaker from '../skills/rhythmBreaker'

const SKILL_REGISTRY: Record<string, Skill> = {
  observationRewrite,
  antiTemplate,
  detailInjection,
  emotionalGrain,
  humanPause,
  rhythmBreaker,
}

const STRATEGY_MAP: Record<string, string[]> = {
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
 */
function mapStrategies(analysis: SentenceAnalysis = {} as SentenceAnalysis, context: SkillContext = {}): Skill[] {
  const names = STRATEGY_MAP[analysis.problem_type] || ['rhythmBreaker']
  const intensity = context.intensity || 'medium'
  const limit = intensity === 'light' ? 1 : intensity === 'deep' ? names.length : Math.min(2, names.length)
  return names.slice(0, limit).map((name) => SKILL_REGISTRY[name]).filter(Boolean)
}

export {
  SKILL_REGISTRY,
  STRATEGY_MAP,
  mapStrategies,
}
