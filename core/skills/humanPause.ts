// ============================================================
// humanPause — 加入真实停顿感，但保持克制
// ============================================================

import type { Skill, SkillContext, SentenceAnalysis } from '../types'
import { cleanup, ensureEnd } from '../types'

const PAUSES: string[] = ['其实', '后来', '有时候', '说实话', '我以前也这样']

const SKIP_PREFIXES: string[] = [
  '我平时', '我会', '你应该也有过', '那天晚上',
  '写到这里的时候', '翻评论区时', '和朋友聊起这件事时',
]

function pickPause(context: SkillContext = {}): string {
  context.usedPauses = context.usedPauses || []
  let available = PAUSES.filter((p) => !context.usedPauses!.includes(p))
  if (available.length === 0) {
    context.usedPauses.length = 0
    available = PAUSES
  }
  const idx = Math.floor(Math.random() * available.length)
  const picked = available[idx]
  context.usedPauses!.push(picked)
  return picked
}

function apply(sentence: string, _analysis: SentenceAnalysis, context: SkillContext = {}): string {
  const text = cleanup(sentence)
  if (!text) return text

  // 如果已经以停顿词开头，跳过
  for (const p of PAUSES) {
    if (text.startsWith(p)) return ensureEnd(text)
  }
  for (const prefix of SKIP_PREFIXES) {
    if (text.startsWith(prefix)) return ensureEnd(text)
  }

  const pause = pickPause(context)

  if (pause === '我以前也这样') {
    return ensureEnd(`${pause}，${text.replace(/[。！？!?]$/, '')}`)
  }

  return ensureEnd(`${pause}，${text.replace(/[。！？!?]$/, '')}`)
}

const skill: Skill = { name: 'humanPause', apply }
export default skill
