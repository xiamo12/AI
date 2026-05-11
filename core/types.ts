// ============================================================
// core/ 模块共享类型
// ============================================================

/** 句子分析结果类型（从 aiPatternAnalyzer 引用避免循环） */
export interface SentenceAnalysis {
  sentence: string
  problem_type: string
  severity: number
  rewrite_direction: string
}

/** Skill 调用上下文 — 跨句子共享的状态 */
export interface SkillContext {
  /** 改写强度 */
  intensity?: 'light' | 'medium' | 'deep'
  /** 场景 */
  scene?: string
  articleType?: string
  /** 是否强制变更 */
  forceChange?: boolean
  /** 当前改写轮次 */
  pass?: number
  /** 段落索引 */
  paragraphIndex?: number
  /** 句子索引 */
  sentenceIndex?: number
  /** 句子在段落内的索引 */
  localSentenceIndex?: number
  /** 全文句子总数 */
  totalSentences?: number

  /** 去重记忆 — humanPause 用过的停顿词 */
  usedPauses?: string[]
  /** 去重记忆 — emotionalGrain 用过的颗粒度词 */
  usedGrains?: string[]
  /** 去重记忆 — detailInjection 用过的细节词 */
  usedDetails?: string[]

  /** 参考文风文本 */
  referenceText?: string
  /** 保留原结构 */
  preserveStructure?: boolean
  styleProfile?: Record<string, unknown>

  [key: string]: unknown
}

/** Skill 函数签名 */
export interface Skill {
  name: string
  apply: (sentence: string, analysis: SentenceAnalysis, context: SkillContext) => string
}

/** 文本清理、ensureEnd 等工具函数 */
export function cleanup(text: string): string {
  return String(text || '').replace(/\s+/g, '').replace(/。{2,}/g, '。').trim()
}

export function ensureEnd(text: string): string {
  const value = cleanup(text)
  if (!value) return value
  return /[。！？!?]$/.test(value) ? value : `${value}。`
}
