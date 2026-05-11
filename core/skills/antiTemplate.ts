// ============================================================
// antiTemplate — 降低高频模板词的存在感
//
// 把"概念标签"改成"人能看见的说法"，
// 让句子从口号回到可理解的日常表达。
// ============================================================

import type { Skill, SentenceAnalysis } from '../types'
import { cleanup, ensureEnd } from '../types'

interface TemplateRoute {
  test: RegExp
  build: (text: string) => string
}

const TEMPLATE_ROUTES: TemplateRoute[] = [
  { test: /长期主义/, build: (text) => text.replace(/长期主义/g, '把一件小事持续做下去的耐心') },
  { test: /底层逻辑/, build: (text) => text.replace(/底层逻辑/g, '背后真正起作用的原因') },
  { test: /本质上/, build: (text) => text.replace(/本质上[，,]?/g, '拆开看，') },
  { test: /破局/, build: (text) => text.replace(/破局/g, '从卡住的地方往前挪一步') },
  { test: /闭环/, build: (text) => text.replace(/闭环/g, '把事情从开始做到有结果') },
  { test: /松弛感/, build: (text) => text.replace(/松弛感/g, '不再一直绷着的状态') },
  { test: /内耗/, build: (text) => text.replace(/内耗/g, '自己跟自己较劲') },
  { test: /情绪价值/, build: (text) => text.replace(/情绪价值/g, '让人待在一起舒服的感觉') },
  { test: /与其[^，。！？；;\n]{1,46}不如/, build: (text) => text.replace(/与其([^，。！？；;]{1,46})不如/g, '比起$1，不如') },
  { test: /一方面[^。！？；;\n]{1,70}另一方面/, build: (text) => text.replace(/一方面([^。！？；;\n]{1,70})另一方面/g, '$1同时，') },
  { test: /从[^。！？；;，,\n]{1,28}到[^。！？；;，,\n]{1,28}再到/, build: (text) => text.replace(/从([^。！？；;，,\n]{1,28})到([^。！？；;，,\n]{1,28})再到/g, '不管是$1、$2，还是') },
  { test: /既要[^。！？；;\n]{1,46}也要/, build: (text) => text.replace(/既要/g, '不能只看').replace(/，?也要/g, '，也得看') },
  { test: /对于[^，。！？；;\n]{1,28}来说/, build: (text) => { const r = text.replace(/对于[^，。！？；;\n]{1,28}来说[，,]?/g, ''); return r.trim() ? r : text } },
  { test: /愿你/, build: (text) => text.replace(/愿你/g, '祝你') },
  { test: /你要明白/, build: (text) => text.replace(/你要明白/g, '你会发现') },
  { test: /不知不觉/, build: (text) => text.replace(/不知不觉中?[，,]?/g, '慢慢发现，') },
  { test: /首先.*其次.*最后/, build: (text) => text.replace(/最后[，,]?/g, '说到底，') },
  { test: /当[^，。！？；;\n]{1,28}的时候/, build: (text) => text.replace(/当([^，。！？；;\n]{1,28})的时候[，,]?/g, '$1那会儿，') },
]

function apply(sentence: string, _analysis: SentenceAnalysis, _context?: Record<string, unknown>): string {
  let text = cleanup(sentence)
  if (!text) return text

  TEMPLATE_ROUTES.forEach((route) => {
    if (route.test.test(text)) text = route.build(text)
  })

  // inline 替换
  text = text
    .replace(/在当今社会[，,]?/g, '这几年，')
    .replace(/随着时代的发展[，,]?/g, '这几年变化很快，')
    .replace(/可以说[，,]?/g, '')
    .replace(/值得注意的是[，,]?/g, '有个细节我后来才注意到，')
    .replace(/综上所述[，,]?/g, '回头看，')
    .replace(/总的来说[，,]?/g, '回头看，')
    .replace(/总而言之[，,]?/g, '说简单点，')
    .replace(/首先[，,]?/g, '一来，')
    .replace(/其次[，,]?/g, '二来，')
    .replace(/不知不觉中?[，,]?/g, '慢慢发现，')

  // 特殊句式处理
  if (/真正[^。！？；;]{0,18}的人/.test(text)) {
    text = text.replace(/真正[^，。！？；;]{0,18}的人/g, '能把事情做久的人')
  }

  return ensureEnd(text)
}

const skill: Skill = { name: 'antiTemplate', apply }
export default skill
