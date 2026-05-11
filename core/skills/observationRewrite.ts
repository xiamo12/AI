// ============================================================
// observationRewrite — 把"观点句/判断句"改成"观察句"
// ============================================================

import type { Skill, SentenceAnalysis } from '../types'
import { cleanup, ensureEnd } from '../types'

function extractTopic(sentence: string): string {
  const text = cleanup(sentence)
  const match = text.match(/真正[^，。！？；;]{0,18}的人[，,]?([^。！？；;]*)/)
  if (match && match[1]) return match[1].replace(/^都/, '')
  const second = text.match(/([^，。！？；;]{2,16})(不是|并不是|其实不是)/)
  if (second && second[1]) return second[1]
  return text.replace(/[。！？!?]$/, '')
}

function apply(sentence: string, _analysis?: SentenceAnalysis, _context?: Record<string, unknown>): string {
  const text = cleanup(sentence)
  if (!text) return text

  if (/不是[^。！？；;]{1,46}而是/.test(text)) {
    const parts = text.split(/不是|而是/)
      .map((item) => item.replace(/[，,。]/g, '').trim())
      .filter(Boolean)
    const before = parts[0] || '这件事'
    const after = (parts[parts.length - 1] || '换一种做法').replace(/真正值得的人/g, '那些让你舒服的人')
    return ensureEnd(`后来再看${before}，我反而觉得重点没那么复杂。更该放在心上的，是${after}`)
  }

  if (/真正[^。！？；;]{0,18}的人/.test(text)) {
    let topic = extractTopic(text).replace(/^有/, '')
    if (/长期主义/.test(topic)) topic = '把一件事持续做下去的耐心'
    const objectPhrase = /^把/.test(topic) ? topic : `把${topic || '一件事'}`
    return ensureEnd(`后来我发现，很多走得远的人，一开始也没有多厉害。他们更多是${objectPhrase}放在更长的时间里慢慢做`)
  }

  if (/你要明白|本质上|说到底|归根结底/.test(text)) {
    const softer = text
      .replace(/你要明白[，,]?/, '')
      .replace(/本质上[，,]?/, '')
      .replace(/说到底[，,]?/, '')
      .replace(/归根结底[，,]?/, '')
      .replace(/[。！？!?]$/, '')
    return ensureEnd(`我以前也容易把这件事想得很大，后来才慢慢觉得，${softer}`)
  }

  if (/应该|必须|一定要|需要/.test(text)) {
    const softer = text.replace(/应该|必须|一定要|需要/g, '可以先试着')
    return ensureEnd(`放到真实生活里看，${softer.replace(/[。！？!?]$/, '')}`)
  }

  return ensureEnd(`后来我发现，${text.replace(/[。！？!?]$/, '')}`)
}

const skill: Skill = { name: 'observationRewrite', apply }
export default skill
