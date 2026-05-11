// ============================================================
// detailInjection — 给抽象句子补入时间、场景、动作或感受
// ============================================================

import type { Skill, SkillContext, SentenceAnalysis } from '../types'
import { cleanup, ensureEnd } from '../types'

const SCENE_DETAILS: Record<string, string[]> = {
  '公众号': ['写到这里的时候', '翻评论区时', '和朋友聊起这件事时'],
  '小红书': ['刷到类似笔记时', '晚上躺下以后', '打开备忘录的时候'],
  '论文': ['放到具体案例里', '回到材料本身', '在实际分析时'],
  '职场': ['开会前后', '收到消息的时候', '把任务拆开以后'],
  '口播': ['你可以想象一下', '说到这里', '放到一个很日常的场景里'],
  '通用文本': ['那天晚上', '后来再遇到类似事情时', '真正动手去做的时候'],
}

function pickDetail(context: SkillContext = {}): string {
  const scene = context.scene || context.articleType || '通用文本'
  const list = SCENE_DETAILS[scene] || SCENE_DETAILS['通用文本']
  context.usedDetails = context.usedDetails || []
  let available = list.filter((d) => !context.usedDetails!.includes(d))
  if (available.length === 0) {
    context.usedDetails.length = 0
    available = list
  }
  const idx = Math.floor(Math.random() * available.length)
  const picked = available[idx]
  context.usedDetails!.push(picked)
  return picked
}

function apply(sentence: string, _analysis: SentenceAnalysis, context: SkillContext = {}): string {
  const text = cleanup(sentence)
  if (!text) return text
  const detail = pickDetail(context)

  if (/我很焦虑|我焦虑|很焦虑/.test(text)) {
    return ensureEnd(`${detail}，我盯着手机看了很久，心里一直有点发紧`)
  }

  if (/^我是专注于/.test(text)) {
    return ensureEnd('我平时会写读书、日常复盘和一些自我管理的事，也会记录自己一路摸索时的感受')
  }

  if (/不知道|不清楚|迷茫/.test(text)) {
    return ensureEnd(`${detail}，我才发现自己不是不努力，而是一直没把问题想清楚`)
  }

  if (/成长|自律|阅读|学习/.test(text)) {
    return ensureEnd(`${text.replace(/[。！？!?]$/, '')}，${detail}，这件事就变得具体了：少讲口号，多给自己留一点真的能动手的时间`)
  }

  if (/关系|拒绝|冷漠|消耗/.test(text)) {
    return ensureEnd(`${detail}，我会先停一下，想想这段关系到底让自己更轻松，还是更累`)
  }

  return ensureEnd(`${detail}，${text.replace(/[。！？!?]$/, '')}`)
}

const skill: Skill = { name: 'detailInjection', apply }
export default skill
