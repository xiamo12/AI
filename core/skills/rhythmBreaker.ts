// ============================================================
// rhythmBreaker — 打散过于整齐的 AI 节奏
// ============================================================

import type { Skill, SentenceAnalysis } from '../types'
import { cleanup, ensureEnd } from '../types'

function apply(sentence: string, _analysis?: SentenceAnalysis, _context?: Record<string, unknown>): string {
  const text = cleanup(sentence)
  if (!text) return text

  const clauses = text.replace(/[。！？!?]$/, '').split(/[，,；;]/).map((item) => item.trim()).filter(Boolean)

  if (clauses.length >= 4) {
    const first = clauses.slice(0, 2).join('，')
    const second = clauses.slice(2).join('，')
    return ensureEnd(`${first}。${second}`)
  }

  if (clauses.length === 3) {
    return ensureEnd(`${clauses[0]}。${clauses.slice(1).join('，')}`)
  }

  if (/不是[^。！？；;]{1,46}而是/.test(text)) {
    return ensureEnd(text.replace(/不是/, '一开始我以为').replace(/而是/, '。后来才发现，更重要的是'))
  }

  if (text.length > 36) {
    const mid = Math.floor(text.length / 2)
    let splitAt = -1
    for (let offset = 0; offset <= 10; offset++) {
      const rightPos = mid + offset
      if (rightPos < text.length && /[，,；;、]/.test(text[rightPos])) {
        splitAt = rightPos
        break
      }
      if (offset > 0) {
        const leftPos = mid - offset
        if (leftPos >= 0 && /[，,；;、]/.test(text[leftPos])) {
          splitAt = leftPos
          break
        }
      }
    }
    if (splitAt > 0) {
      const left = text.slice(0, splitAt).replace(/[，,；;、]$/, '')
      const right = text.slice(splitAt + 1).replace(/^[，,；;、]/, '')
      return ensureEnd(`${left}。${right}`)
    }
    return ensureEnd(text)
  }

  return ensureEnd(text)
}

const skill: Skill = { name: 'rhythmBreaker', apply }
export default skill
