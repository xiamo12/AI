// ============================================================
// emotionalGrain — 为过于平淡的句子补入细微情绪
// ============================================================

import type { Skill, SkillContext, SentenceAnalysis } from '../types'
import { cleanup, ensureEnd } from '../types'

const GRAINS: string[] = [
  '当时我其实没想明白',
  '那一刻会有点烦',
  '后来反倒松了一口气',
  '心里会先犹豫一下',
  '说实话，刚开始我也不太确定',
]

function pickGrain(context: SkillContext = {}): string {
  context.usedGrains = context.usedGrains || []
  let available = GRAINS.filter((g) => !context.usedGrains!.includes(g))
  if (available.length === 0) {
    context.usedGrains.length = 0
    available = GRAINS
  }
  const idx = Math.floor(Math.random() * available.length)
  const picked = available[idx]
  context.usedGrains!.push(picked)
  return picked
}

function apply(sentence: string, _analysis: SentenceAnalysis, context: SkillContext = {}): string {
  const text = cleanup(sentence)
  if (!text) return text
  if (/犹豫|松一口气|有点|没想明白|发慌|烦/.test(text)) return ensureEnd(text)

  if (/^你有没有/.test(text)) {
    return ensureEnd('你应该也有过这种时刻：刚想往前试一下，心里又会先犹豫')
  }

  const grain = pickGrain(context)
  if (/^我/.test(text)) return ensureEnd(`${grain}，${text}`)
  if (/^你/.test(text)) return ensureEnd(`${grain}，${text.replace(/^你/, '人')}`)
  return ensureEnd(`${text.replace(/[。！？!?]$/, '')}，${grain}`)
}

const skill: Skill = { name: 'emotionalGrain', apply }
export default skill
