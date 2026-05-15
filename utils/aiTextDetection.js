// aiTextDetection.js — AI 率检测逻辑 (v2.0)
// 扩展 AI 句式库、虚词密度检测、n-gram 复现率、交叉检测一致性
// 从 aiTextEngine.js 拆出的独立模块

const localDetector = require('./aiDetector')
const { analyzeSemantic } = require('./aiSemanticDetector')
const { analyzeConsistency } = require('./aiSemanticConsistency')
const { clamp, normalizeText, splitSentences } = require('./util')

// ============================================================
// v2.0 扩展: AI 句式指纹库（含 v1.0 全部 + 新增）
// ============================================================
//
// 来源:
// - CCL 2025《中文AI文本的语言特征分析》
// - ACL 2024《Linguistic Features of LLM-Generated Chinese Text》
// - 社区反馈: Claude/GPT-4/DeepSeek 写作模式归纳
//
// 新增类别:
// - 立场前置 (OpenAI 风格的"As an AI...")
// - 价值升华段 (真正的成长/意义/价值)
// - 让步结构 (不得不承认/不可否认…)
// - 框架三段式 (本文从…出发/基于…/围绕…)
// - 空洞鼓励 (相信你自己/值得拥有/未来可期)

const templatePhrases = [
  '综上所述', '总而言之', '不难看出', '值得注意的是', '在当今社会', '随着时代的发展',
  '具有重要意义', '提供了新的思路', '进一步推动', '不可忽视', '本文将从', '以下几个方面',
  '无论是', '不仅如此', '与此同时', '因此', '然而', '此外', '可以说', '某种程度上',
  '在这个过程中', '这意味着', '需要意识到', '归根结底', '本质上', '换句话说', '说到底',
  '显而易见', '毋庸置疑', '不言而喻', '众所周知', '有目共睹', '从某种意义上说',
  '从某种程度来说', '不可否认', '必须承认', '值得注意', '需要指出', '需要说明',
  '我们不难发现', '我们不难看出', '不难理解', '可以预见', '可以想象',
  // v2.0 新增
  '不可否认的是', '不得不承认', '坦白说',
  '从某种角度', '从某个层面', '从一定程度上',
  '扮演着重要的角色', '发挥着重要的作用',
  '基于此', '有鉴于此', '鉴于此',
  '受到广泛的关注', '引起了广泛的讨论',
  '应该看到的是', '需要明确的是', '值得深思的是',
  '在…背景下', '从…视角出发', '以…为导向',
  '值得注意的是', '需要强调的是',
  '与此同时，我们也应该看到',

  // ---- v2.0 论文/学术场景 ----
  '相关研究表明', '文献综述表明', '已有研究指出', '现有文献表明',
  '学术界普遍认为', '主流观点认为', '从学术角度来看',
  '理论框架', '研究方法', '实证分析', '定量研究', '定性分析',
  '研究局限性', '未来研究方向', '尚存争议',

  // ---- v2.0 公众号/营销场景 ----
  '改变你的一生', '彻底改变', '颠覆认知', '认知升级',
  '深度好文', '建议收藏', '值得收藏', '转给需要的人',
  '你一定要看', '别让…', '为什么…', '如何做到',
  '人生的真相', '普通人也能', '从零开始',
  '最可怕的是', '最让人震惊的是', '令人震惊的是',
  '在这个浮躁的时代', '在这个快节奏的时代',

  // ---- v2.0 小红书场景 ----
  '谁懂啊', '我真的会谢', '绝绝子', '给我冲',
  '真的太好用了', '按头安利', '不允许你不知道',
  '姐妹们冲', '闭眼入', '挖到宝了', '无限回购',
  '建议收藏', '干货满满', '保姆级教程',
]

const aiFlavorPatterns = [
  // ---- v1.0 已有 ----
  { label: '不是...而是...', regex: /不是[^。！？；;\n]{1,46}而是/g, weight: 8, type: '句式指纹' },
  { label: '不是...只是...', regex: /不是[^。！？；;\n]{1,46}只是/g, weight: 7, type: '句式指纹' },
  { label: '不是因为...只是...', regex: /不是因为[^。！？；;\n]{1,46}只是/g, weight: 8, type: '句式指纹' },
  { label: '不是因为...而是因为...', regex: /不是因为[^。！？；;\n]{1,46}而是因为/g, weight: 8, type: '句式指纹' },
  { label: '真正的...不是...而是...', regex: /真正的[^。！？；;\n]{1,32}不是[^。！？；;\n]{1,46}而是/g, weight: 8, type: '句式指纹' },
  { label: '所谓...不是...而是...', regex: /所谓[^。！？；;\n]{1,32}不是[^。！？；;\n]{1,46}而是/g, weight: 8, type: '句式指纹' },
  { label: '与其...不如...', regex: /与其[^。！？；;\n]{1,46}不如/g, weight: 6, type: '对照结构' },
  { label: '你以为...其实...', regex: /你以为[^。！？；;\n]{1,46}其实/g, weight: 6, type: '转折模板' },
  { label: '一方面...另一方面...', regex: /一方面[^。！？\n]{1,70}另一方面/g, weight: 6, type: '结构模板' },
  { label: '首先...其次...最后...', regex: /首先[^。！？\n]{1,90}其次[^。！？\n]{1,90}(最后|总之|因此)/g, weight: 7, type: '结构模板' },
  { label: '从...到...再到...', regex: /从[^。！？；;\n]{1,28}到[^。！？；;\n]{1,28}再到/g, weight: 5, type: '排比结构' },
  { label: '既要...也要...', regex: /既要[^。！？；;\n]{1,46}也要/g, weight: 5, type: '并列结构' },
  { label: '对于...来说...', regex: /对于[^。！？；;\n]{1,28}来说/g, weight: 4, type: '泛化表达' },
  { label: '你要明白...', regex: /你要明白/g, weight: 5, type: '口吻模板' },
  { label: '愿你...', regex: /愿你/g, weight: 4, type: '鸡汤口吻' },
  { label: '长期主义', regex: /长期主义/g, weight: 5, type: '概念词' },
  { label: '底层逻辑', regex: /底层逻辑/g, weight: 2, type: '概念词' },
  { label: '情绪价值', regex: /情绪价值/g, weight: 2, type: '概念词' },
  { label: '内耗', regex: /内耗/g, weight: 1, type: '概念词' },
  { label: '松弛感', regex: /松弛感/g, weight: 3, type: '概念词' },
  { label: '赋能', regex: /赋能/g, weight: 4, type: '概念词' },
  { label: '闭环', regex: /闭环/g, weight: 4, type: '概念词' },
  { label: '颗粒度', regex: /颗粒度/g, weight: 4, type: '概念词' },
  { label: '齐抓共管', regex: /齐抓共管/g, weight: 4, type: '公文腔' },
  { label: '多措并举', regex: /多措并举/g, weight: 4, type: '公文腔' },
  { label: '落地', regex: /落地/g, weight: 1, type: '概念词' },
  { label: '抓手', regex: /抓手/g, weight: 3, type: '概念词' },

  // ---- v2.0 新增 ----
  // 价值升华结构
  { label: '真正的成长/价值/意义', regex: /真正的(成长|价值|意义|自由|幸福|成功|强大)/g, weight: 6, type: '价值升华' },
  // 排斥性否定: 不是A不是B而是C（三段否定）
  { label: '不是A不是B而是C', regex: /不是[^。！？；;\n]{1,30}不是[^。！？；;\n]{1,30}而是/g, weight: 9, type: '三重否定' },
  // 让步结构
  { label: '虽然/尽管…但不可否认', regex: /(虽然|尽管)[^。！？；;\n]{1,60}(?:但不能否认|不可否认的是|不得不承认)/g, weight: 6, type: '让步结构' },
  // "需要…的是" 抽象导向
  { label: '需要…的是', regex: /需要(?:注意|明确|强调|认清|认识到|明白)[^。！？；;\n]{1,12}的是/g, weight: 5, type: '抽象导向' },
  // "从…出发/角度/视角来看"
  { label: '从…来看/出发/出发', regex: /从[^。！？；;\n]{1,28}(?:的角度来看|的视角出发|出发[，,])/g, weight: 5, type: '框架前置' },
  // "基于…/考虑到…" 常见 AI 过渡
  { label: '基于此/有鉴于此', regex: /(基于此|有鉴于此|鉴于此)[，,]/g, weight: 5, type: '框架衔接' },
  // 空洞鼓励/鸡汤升华
  { label: '未来可期', regex: /未来可期/g, weight: 4, type: '鸡汤升华' },
  { label: '愿你/希望你', regex: /(愿你|希望你能|希望我们都能)[^。！？\n]{4,}/g, weight: 4, type: '鸡汤口吻' },
  // "受到了广泛的关注" 被动抽象
  { label: '引起广泛关注/讨论', regex: /(?:引起|受到|引发)(?:广泛|极大|诸多)(?:关注|讨论|争议|重视)/g, weight: 4, type: '抽象概括' },
  // "扮演着重要的角色" 虚化表达
  { label: '扮演着重要的角色', regex: /扮演着[^。！？；;\n]{1,28}的角色/g, weight: 5, type: '虚化表达' },
  // "以…为核心/为基础/为导向"
  { label: '以…为导向为基础', regex: /以[^。！？；;\n]{1,28}(?:为核心|为基础|为导向|为依托|为抓手)/g, weight: 5, type: '公文套话' },
  // "充分认识到/深刻认识到"
  { label: '充分/深刻认识到', regex: /(?:充分|深刻)认识[到，]?/g, weight: 4, type: '公文套话' },
  // "正如…所说"引用万能句式
  { label: '正如…所说/所言', regex: /正如[^。！？；;\n]{1,28}(?:所说|所言)[，,]/g, weight: 4, type: '万能引用' },

  // ---- GPT-4o/Claude 3.5 时代新增 ----
  // "让我…" 开头段落
  { label: '让我…', regex: /让我[们]?[们来为你给大家][^。！？\n]{8,}/g, weight: 5, type: 'AI引导' },
  // "从某种意义上来说"拉长版
  { label: '从某种意义上来说', regex: /从某种(?:意义|角度|程度|层面)(?:上|来说|来看)[，,]?/g, weight: 5, type: '模糊限定' },
  // "在某种程度上" 同族
  { label: '在某种程度', regex: /在某种程度[上][，,]?/g, weight: 4, type: '模糊限定' },
  // "值得指出的是/值得强调的是"
  { label: '值得指出/强调的是', regex: /值得(?:指出|强调|注意|关注|思考)的是/g, weight: 5, type: '价值提示' },
  // "我们必须认识到/我们应当认识到"
  { label: '我们必须/应当认识到', regex: /我们(?:必须|应当|需要|应该)认识到/g, weight: 5, type: '号召口吻' },
  // "归根到底/说到底/归根结底" 扩大匹配
  { label: '归根到底/归根结底', regex: /归根(?:到底|结底)[，,]?/g, weight: 5, type: '总结套话' },
  // "不止于此/不仅如此"
  { label: '不止于此/不仅如此', regex: /(?:不止于此|不仅如此)[，,]?/g, weight: 4, type: '递进套话' },
  // "在很大程度上/在相当程度上"
  { label: '在很大/相当程度上', regex: /在(?:很大|相当|一定)程度上[，,]?/g, weight: 4, type: '模糊限定' },
  // "这并不意味着…而是…"
  { label: '这并不意味着…而是…', regex: /这并不意味着[^。！？；;\n]{1,46}(?:而是|相反)/g, weight: 6, type: '拐弯否定' },
  // "从这个意义上来说"
  { label: '从这个意义上来说', regex: /从这个意义上(?:说|讲|来看)[，,]?/g, weight: 4, type: '模糊总结' },
  // 长句首"当我/当你/当我们" 引出鸡汤
  { label: '当你/当我…的时候', regex: /(?:当我|当你|当我们)[^。！？；;\n]{1,120}(?:就懂得了|就会明白|才能真正|才会发现|才会懂得)/g, weight: 6, type: '鸡汤长句' },
  // "这大概就是…的意义"
  { label: '这大概就是…的意义', regex: /这大概就是[^。！？；;\n]{1,30}的(?:意义|价值|魅力|真谛)/g, weight: 5, type: '升华模板' },
  // "在…的今天"
  { label: '在…的今天', regex: /在[^。！？；;\n]{1,28}的今天[，,]?/g, weight: 4, type: '时间套话' },

  // ---- v2.0 论文场景新增 ----
  { label: '文献表明/研究表明/有学者指出', regex: /(?:文献|研究|数据|调查|报告|实验)[^。！？；;\n]{0,8}(?:表明|显示|指出|证明|发现)/g, weight: 5, type: '学术套话' },
  { label: '引发了学术界的广泛关注', regex: /引发了[^。！？；;\n]{1,20}(?:学术|业界|社会)界的(?:广泛|极大|诸多)(?:关注|讨论)/g, weight: 5, type: '学术套话' },
  { label: '存在…的问题/不足/争议', regex: /存在[^。！？；;\n]{1,24}(?:问题|不足|争议|缺陷|局限|挑战)/g, weight: 4, type: '学术套话' },
  { label: '具有重要的理论意义和实践价值', regex: /具有(?:重要|深远|显著)[^。！？；;\n]{1,20}(?:理论|实践|现实)(?:意义|价值)/g, weight: 6, type: '学术模板' },
  { label: '有待进一步研究/深入探讨', regex: /有待(?:进一步|深入)(?:研究|探讨|探索|分析)/g, weight: 4, type: '学术结尾' },

  // ---- v2.0 公众号/营销场景新增 ----
  { label: '你一定要知道/你必须了解', regex: /你(?:一定|千万|务必)(?:要|得|需要)[^。！？；;\n]{1,20}(?:知道|了解|记住|学会)/g, weight: 6, type: '营销口吻' },
  { label: '月入过万/轻松赚钱/财富自由', regex: /(?:月入|年入|轻松赚|暴富|财富自由)/g, weight: 5, type: '营销话术' },
  { label: '看完你就懂了/学会了/明白了', regex: /看完[^。！？；;\n]{0,8}(?:就|便|自然|一定)(?:懂|学会|明白|知道)/g, weight: 5, type: '营销引导' },
  { label: '很多人不知道的是', regex: /很多人不(?:知道|了解|清楚)[^。！？；;\n]{0,4}的是/g, weight: 5, type: '悬念开头' },
  { label: '你一定要读完/一定看到最后', regex: /你(?:一定|千万)(?:要读完|要看完|看到最后|读到最后)/g, weight: 4, type: '营销引导' },

  // ---- v2.0 小红书场景新增 ----
  { label: '谁懂啊/谁懂这种感觉', regex: /谁懂[啊吧]|谁懂这种感觉/g, weight: 4, type: '小红书感叹' },
  { label: '救命/绝了/封神了', regex: /(?:救命|绝了|封神了|太上头了|破防了)/g, weight: 3, type: '小红书感叹' },
  { label: '建议所有…都去…', regex: /建议所有[^。！？；;\n]{1,20}都[^。！？；;\n]{1,20}/g, weight: 5, type: '小红书模板' },
  { label: '不允许还有人不知道', regex: /不允许还(?:有|有人)[^。！？；;\n]{0,4}不(?:知道|了解)/g, weight: 4, type: '小红书句式' },
  { label: '小个子/梨形/黄黑皮', regex: /(?:小个子|梨形身材|苹果型|黄黑皮|干皮|油皮|敏感肌)/g, weight: 2, type: '小红书标签' },
]

const concretePatterns = [
  /\d+(\.\d+)?%?/g, /20\d{2}年/g, /第[一二三四五六七八九十\d]+/g,
  /《[^》]{2,}》/g,  /https?:\/\/\S+/g, /\d+月/g, /\d+日/g, /\d+[点时]/g,
  // 引号：仅统计对话引号（5字及以上），排除抽象概念加引号（如"有一天""第几天"）
  /"[^"]{5,}"/g,
  // v2.1 扩展: 增强具体性检测
  /[一二三四五六七八九十百千万亿]+[元只个条张件家口座间栋层次]/g,  // 中文量词
  /[A-Z\u00C0-\u00D6\u00D8-\u00DE][a-z\u00E0-\u00F6\u00F8-\u00FE]{1,10}[\s，。！？]/g,  // 专有名词（大写开头英文）
  /(?:区|路|街|道|大道|大桥|大厦|小区|公园|广场)[，。；]?$/gm,  // 地名片段
  /(?:有限公司|集团|股份|医院|大学|中学|研究院|工作室|品牌|平台)/g,  // 机构名
  /\d{3,4}[-—]\d{3,8}/g,  // 电话/邮编
  /\d+[kK万Ww]?[元¥$€]/g,  // 金额
]
const humanSignalPatterns = [/当时/g, /后来/g, /最近/g, /今天/g, /比如/g, /举个例子/g, /说实话/g, /坦白讲/g, /具体来看/g, /放到具体场景/g, /我记得/g, /有一次/g, /那天/g, /有次/g, /我觉得/g, /我感觉/g, /我见过/g, /我遇到/g]

/**
 * 伪分词：基于标点和虚词边界做分词，替代第三方 jieba
 */
function pseudoTokenize(text) {
  // 1) 标点拆分为最小 clause
  const parts = text
    .replace(/[，,。！？!?；;：:、""''（）()《》【】「」『』〔〕…—–\-~\n\r]/g, ' ')
    // 2) 在常见虚词前后插入空格形成伪词边界
    .replace(new RegExp('([的了着过把被对于在在和与等跟从向沿着朝着按照凭靠根据关于由于为了除了比同跟和或及以及不但因为所以虽然但是如果然而而且因此])', 'g'), ' $1 ')
    .split(/\s+/)
    .filter(Boolean)
  return parts
}

/**
 * 词级 N-gram 重复率
 * AI 文本在词级 2-gram/3-gram 上的重复率显著高于人类文本
 * 这是目前网文平台、MBA论文检测中权重最高的维度之一
 */
function wordLevelNgramRepetition(text, n = 2) {
  const tokens = pseudoTokenize(normalizeText(text))
  if (tokens.length < n + 3) return 0
  const ngrams = {}
  for (let i = 0; i <= tokens.length - n; i++) {
    const key = tokens.slice(i, i + n).join('')
    ngrams[key] = (ngrams[key] || 0) + 1
  }
  const total = Object.values(ngrams).reduce((a, b) => a + b, 0)
  if (total === 0) return 0
  // 重复率 = 出现 2+ 次的 ngram 占总 ngrum 数的比例
  const repeatedCount = Object.values(ngrams).filter(c => c > 1).reduce((a, b) => a + b, 0)
  return repeatedCount / total
}

function splitParagraphs(text) {
  return normalizeText(text).split(/\n+/).map((item) => item.trim()).filter(Boolean)
}

function countMatches(text, regex) {
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function getUniqueRatio(text) {
  const chars = normalizeText(text).replace(/\s|[，。！？；：、"")'（）()《》,.!?;:]/g, '').split('')
  if (!chars.length) return 0
  return new Set(chars).size / chars.length
}

function getSentenceVariance(sentences) {
  if (sentences.length < 2) return 0
  const lengths = sentences.map((item) => item.length)
  const avg = lengths.reduce((sum, item) => sum + item, 0) / lengths.length
  const variance = lengths.reduce((sum, item) => sum + Math.pow(item - avg, 2), 0) / lengths.length
  return Math.sqrt(variance) / Math.max(avg, 1)
}

function getClauseShape(clause) {
  return clause.replace(/[我你他她它们自己真正一个一种很多所有那些这些]/g, '').replace(/\d+/g, '0').slice(0, 4)
}

function countParallelismHits(text) {
  const clauses = normalizeText(text).split(/[，,；;。！？!?\n]/).map((item) => item.trim()).filter((item) => item.length >= 6)
  let hits = 0
  let sameStartRun = 1
  let sameShapeRun = 1
  for (let index = 1; index < clauses.length; index += 1) {
    const current = clauses[index]
    const previous = clauses[index - 1]
    sameStartRun = current.slice(0, 2) === previous.slice(0, 2) ? sameStartRun + 1 : 1
    sameShapeRun = getClauseShape(current) === getClauseShape(previous) ? sameShapeRun + 1 : 1
    if (sameStartRun === 3) hits += 1
    if (sameShapeRun === 3) hits += 1
  }
  return hits + countMatches(text, /既[^。！？；;\n]{1,24}也[^。！？；;\n]{1,24}更/g) + countMatches(text, /越[^。！？；;\n]{1,18}越/g)
}

// ============================================================
// v3.0 上下文感知: 新增辅助函数
// ============================================================

/**
 * 策略一: 上下文感知的"不是…而是"分类
 * 检查"而是"后面是否跟具体场景/引语/人称动作（人类写作特征）
 * 如果是人类味的对比论证，返回 true
 */
function isHumanNotButContext(text, matchStart, matchLength) {
  // 匹配完整的"不是...而是..."部分
  const afterErShi = text.slice(matchStart + matchLength, matchStart + matchLength + 30)
  // 检查"而是"后面15字内
  const checkWindow = afterErShi.slice(0, 15)
  // AI味信号：抽象概念、价值判断、空洞总结
  const aiSignal = /(真正的|成长|价值|意义|自由|幸福|成功|强大|至关重要|不可忽视|本质|核心|关键|在于)/.test(checkWindow)
  // 人类味信号：引号、具体人称动作、具体名词、问句
  const humanSignal = /["""''""]/.test(checkWindow) || // 引号（具体话语）
    /[他她它你我他们]/.test(checkWindow) || // 人称
    /(这个|那个|一个|同事|朋友|孩子|书|钱|工作|问题|事情|时候|原因|结果)/.test(checkWindow) // 具体名词
  if (humanSignal && !aiSignal) return true
  if (aiSignal && !humanSignal) return false
  // 模糊时：检查整个句子的具体性
  const sentenceEnd = text.indexOf('。', matchStart) > 0 ? text.indexOf('。', matchStart) : text.indexOf('\n', matchStart)
  const fullSentence = text.slice(Math.max(0, text.lastIndexOf('。', matchStart) + 1), sentenceEnd > 0 ? sentenceEnd + 1 : matchStart + matchLength + 30)
  // 有人称、引号或具体日期数字 → 人类
  if (/["""''""]/.test(fullSentence) || /[他她]/.test(fullSentence) || /\d+/.test(fullSentence)) return true
  return false
}

/**
 * 策略二: 概念词是否被自然使用
 * 如果出现在问句中/引号内/周围有具体实例 → 自然使用
 */
function isConceptUsedNaturally(text, matchStart) {
  const before = text.slice(Math.max(0, matchStart - 20), matchStart)
  const after = text.slice(matchStart, matchStart + 30)
  // 问句中 → 自然（"底层逻辑是什么？"）
  if (/(什么|怎么|如何|为啥|为什么)\s*$/.test(before.trim())) return true
  if (/^\s*(什么|怎么|如何|为啥|为什么|[？?])/.test(after)) return true
  // 引号内 → 自然
  const lineStart = text.lastIndexOf('\n', matchStart)
  const lineEnd = text.indexOf('\n', matchStart)
  const line = text.slice(lineStart >= 0 ? lineStart : 0, lineEnd > 0 ? lineEnd : text.length)
  if (/["""''""]/.test(line.slice(0, matchStart - lineStart)) && 
      /["""''""]/.test(line.slice(matchStart - lineStart))) return true
  // 周围有具体实例 → 自然
  const context = before.slice(-15) + after.slice(0, 15)
  if (/(比如|例如|举例|像|如|具体|什么|一个|这个|那个)/.test(context)) return true
  return false
}

/**
 * 策略四: 检测文本体裁
 * 返回 'argumentative'（说理/议论文）或 'narrative'（叙事/故事）或 'general'
 */
function detectGenre(text) {
  // 说理文标记: 结构化标题、序号、对比框架
  const argumentativeSignals = [
    /[一二三四五六七八九十]+[、.．]/g,
    /首先[，,].*其次[，,]/g,
    /第[一二三四五六七八九十\d]+[个类点种]/g,
    /特征[一二三四五六七八九十\d]/g,
    /总结下来|归纳起来|主要有/,
    /一方面.*另一方面/,
  ]
  // 叙事文标记: 个人经历、时间线、具体场景
  const narrativeSignals = [
    /有一次|那[天次年]|我记得|当时|后来|以前|曾经/,
    /搬家|遇见|遇到|碰到|发现|开始|坚持了/,
    /朋友|同事|同学|家人|邻居/,
    /书|跑步|画画|小说|日记/,
  ]
  let argScore = 0
  let narScore = 0
  argumentativeSignals.forEach(p => {
    const m = text.match(p)
    if (m) argScore += m.length
  })
  narrativeSignals.forEach(p => {
    const m = text.match(p)
    if (m) narScore += m.length
  })
  if (argScore >= 2 && argScore > narScore) return 'argumentative'
  if (narScore >= 3 && narScore > argScore) return 'narrative'
  return 'general'
}

/**
 * 策略五: 句子长度原始标准差
 * 高标准差 = 人类写作铁证（AI句子长度过于均匀）
 */
function getSentenceLengthStd(sentences) {
  if (sentences.length < 6) return 0
  const lengths = sentences.map(s => s.length)
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avg, 2), 0) / lengths.length
  const std = Math.sqrt(variance)
  const maxLen = Math.max(...lengths)
  const minLen = Math.min(...lengths)
  return { std, range: maxLen - minLen, maxLen, minLen }
}

/**
 * 策略三: 计算具体细节密度
 */
function getConcreteDensity(concreteHits, wordCount) {
  if (wordCount < 50) return 0
  return concreteHits / wordCount
}

// 四字短语密度检测
function countFourCharPhrases(text) {
  const fourCharPatterns = [
    /具有重要意义/g, /提供了新的/g, /进一步推动/g, /不可忽视/g,
    /归根结底/g, /显而易见/g, /毋庸置疑/g, /不言而喻/g,
    /众所周知/g, /有目共睹/g, /不可否认/g, /齐抓共管/g,
    /多措并举/g, /落地见效/g, /走深走实/g, /见行见效/g,
    /提质增效/g, /转型升级/g, /不断优化/g, /持续改进/g,
    /全面提升/g, /系统推进/g, /统筹兼顾/g, /协同发展/g,
    /专项整治/g, /精准施策/g, /分类施策/g, /标本兼治/g,
    /源头治理/g, /综合治理/g, /有效防范/g, /坚决遏制/g,
    /深入推进/g, /稳步推进/g, /有序推进/g, /加快推进/g,
    /日益凸显/g, /日渐突出/g, /更趋复杂/g, /日趋严峻/g,
    /不断深化/g, /持续巩固/g, /不断健全/g, /逐步完善/g,
    /显著提升/g, /明显改善/g, /大幅提高/g, /稳步提升/g,
    /有效提升/g, /切实增强/g, /充分认识/g, /深刻认识/g,
    /高度重视/g, /密切关注/g, /认真贯彻/g, /全面落实/g,
    /严格规范/g, /严肃查处/g, /严厉打击/g, /依法打击/g,
    /牢牢把握/g, /紧紧抓住/g, /着力解决/g, /切实解决/g,
    // v2.0 新增
    /精准发力/g, /持续发力/g, /久久为功/g, /善作善成/g,
    /落地生根/g, /开花结果/g, /闯出新路/g, /开创新局/g,
    /同频共振/g, /同向发力/g, /合力攻坚/g, /靶向治疗/g,
    /固本培元/g, /守正创新/g, /固强补弱/g, /查漏补缺/g,
    /常态长效/g, /长治长效/g, /建章立制/g, /立行立改/g,
    /举一反三/g, /深挖细查/g, /把脉问诊/g, /对症下药/g,
    /精准滴灌/g, /深耕细作/g, /蓄势赋能/g, /集成创新/g,
    /破立并举/g, /先立后破/g, /系统集成/g, /协同高效/g,
    /行稳致远/g, /进而有为/g, /厚积薄发/g, /笃行致远/g,
    /未来可期/g, /大有可为/g, /大有作为/g, /前景可期/g,
  ]
  let count = 0
  fourCharPatterns.forEach((pattern) => {
    const m = text.match(pattern)
    if (m) count += m.length
  })
  return count
}

function collectPatternHits(text, fullText) {
  const details = []
  let score = 0
  aiFlavorPatterns.forEach((pattern) => {
    const matches = text.match(pattern.regex)
    if (matches && matches.length) {
      let contextAdjustedScore = matches.length * pattern.weight
      // 如果是"不是…而是"类句式，检查上下文
      if (fullText && (
        pattern.label.indexOf('不是') >= 0 ||
        pattern.label.indexOf('而是') >= 0 ||
        pattern.label.indexOf('不等于') >= 0
      )) {
        let humanMatchCount = 0
        // 重新对每个匹配位置做上下文检查
        const regex = new RegExp(pattern.regex.source, 'g')
        let m
        while ((m = regex.exec(fullText)) !== null) {
          if (isHumanNotButContext(fullText, m.index, m[0].length)) {
            humanMatchCount++
          }
        }
        // 人类味匹配仅计原权重的20%
        const aiMatchCount = matches.length - humanMatchCount
        contextAdjustedScore = aiMatchCount * pattern.weight + humanMatchCount * Math.round(pattern.weight * 0.2)
      }
      // 概念词上下文判断
      if (fullText && pattern.type === '概念词' && pattern.weight > 1) {
        let naturalCount = 0
        const regex = new RegExp(pattern.regex.source, 'g')
        let m
        while ((m = regex.exec(fullText)) !== null) {
          if (isConceptUsedNaturally(fullText, m.index)) {
            naturalCount++
          }
        }
        if (naturalCount > 0) {
          const aiCount = matches.length - naturalCount
          contextAdjustedScore = aiCount * pattern.weight + naturalCount * 1
        }
      }
      score += contextAdjustedScore
      details.push({ label: pattern.label, count: matches.length, type: pattern.type, weight: pattern.weight, contextScore: contextAdjustedScore })
    }
  })
  const templateCount = templatePhrases.reduce((total, phrase) => total + (text.indexOf(phrase) >= 0 ? 1 : 0), 0)
  if (templateCount) {
    score += templateCount * 4
    details.push({ label: '总结/过渡套话', count: templateCount, type: '模板表达', weight: 4 })
  }
  const parallelismHits = countParallelismHits(text)
  if (parallelismHits) {
    score += parallelismHits * 7
    details.push({ label: '连续排比或相似句式堆叠', count: parallelismHits, type: '节奏结构', weight: 7 })
  }
  return { score, details: details.sort((a, b) => b.count * b.weight - a.count * a.weight) }
}

function classifyRisk(score) {
  if (score >= 85) return { riskLevel: 'AI痕迹极高频', riskClass: 'high', riskText: '极高频', rank: 6 }
  if (score >= 70) return { riskLevel: 'AI痕迹高频', riskClass: 'high', riskText: '高频', rank: 5 }
  if (score >= 50) return { riskLevel: 'AI痕迹严重', riskClass: 'high', riskText: '严重', rank: 4 }
  if (score >= 30) return { riskLevel: 'AI痕迹一般', riskClass: 'medium', riskText: '一般', rank: 3 }
  if (score >= 10) return { riskLevel: 'AI痕迹较低', riskClass: 'low', riskText: '较低', rank: 2 }
  return { riskLevel: 'AI痕迹极低', riskClass: 'low', riskText: '极低', rank: 1 }
}

function makeSuggestion(labels) {
  if ((labels || []).some((item) => item.indexOf('不是') >= 0 || item.indexOf('而是') >= 0 || item.indexOf('否定') >= 0)) return '减少"不是…而是…"式对照，改成具体场景、动作或个人观察。'
  if ((labels || []).some((item) => item.indexOf('排比') >= 0 || item.indexOf('堆叠') >= 0)) return '打散连续排比，保留一两个重点句，其余改成自然叙述。'
  if ((labels || []).some((item) => item.indexOf('套话') >= 0 || item.indexOf('模板') >= 0 || item.indexOf('升华') >= 0)) return '删掉泛泛总结，补充更具体的事件、对象、时间或细节。'
  if ((labels || []).some((item) => item.indexOf('鸡汤') >= 0 || item.indexOf('号召') >= 0)) return '减少号召式口吻，改成个人实际经历中的反思。'
  if ((labels || []).some((item) => item.indexOf('概念词') >= 0 || item.indexOf('虚化') >= 0)) return '把概念标签换成具体动作描述，让表达落到实处。'
  if ((labels || []).some((item) => item.indexOf('公文') >= 0)) return '减少公文套话，改成平实的日常用语。'
  return '加入更明确的主体、场景和判断依据，让表达更像真实写作。'
}

function optimizeSentence(sentence) {
  return sentence
    .replace(/不是([^，。！？；;\n]{1,32})，?而是/g, '比起$1，更像是')
    .replace(/不是([^，。！？；;\n]{1,32})，?只是/g, '表面上$1，实际更接近')
    .replace(/综上所述|总而言之|不难看出|值得注意的是/g, '')
    .replace(/在当今社会|随着时代的发展/g, '现在')
    .replace(/具有重要意义/g, '很重要')
    .replace(/这意味着/g, '也就是说')
    .replace(/需要意识到/g, '得承认')
    .trim()
}

function buildIssues(paragraphs) {
  const issues = []
  paragraphs.forEach((paragraph) => {
    const sentences = splitSentences(paragraph.text)
    sentences.forEach((sentence, sentenceIndex) => {
      const hit = collectPatternHits(sentence)
      const lengthScore = sentence.length > 58 ? 10 : 0
      const score = clamp(24 + Math.round(hit.score * 1.8) + lengthScore, 0, 98)
      if (score >= 38 || hit.details.length) {
        const risk = classifyRisk(score)
        const labels = hit.details.map((item) => item.label).slice(0, 4)
        issues.push({
          id: `${paragraph.index}-${sentenceIndex}`,
          paragraphIndex: paragraph.index,
          order: issues.length + 1,
          text: sentence,
          score,
          labels: labels.length ? labels : ['表达偏模板化'],
          risk: risk.riskText,
          riskClass: risk.riskClass,
          riskRank: risk.rank,
          problem: labels.length ? `命中 ${labels.join('、')}，读感偏模板。` : '句子较长且抽象，缺少具体语境。',
          suggestion: makeSuggestion(labels),
          example: optimizeSentence(sentence) || sentence,
          expanded: false,
        })
      }
    })
  })
  return issues.sort((a, b) => b.riskRank - a.riskRank || a.order - b.order)
}

/**
 * analyzeArticle v2.0
 *
 * 增强点:
 * 1. 更均衡的特征权重分配（微调各信号强度）
 * 2. 虚词密度和 n-gram 复现率加入总分
 * 3. 多检测器一致性交叉验证
 * 4. 置信度校准
 */
function analyzeArticle(text, options = {}) {
  const normalized = normalizeText(text)
  const paragraphsText = splitParagraphs(normalized)
  const sentences = splitSentences(normalized)
  const wordCount = normalized.replace(/\s/g, '').length
  const averageSentenceLength = sentences.length ? sentences.reduce((sum, item) => sum + item.length, 0) / sentences.length : 0
  const uniqueRatio = getUniqueRatio(normalized)
  const variance = getSentenceVariance(sentences)
  const wholeHits = collectPatternHits(normalized, normalized)
  const concreteHits = concretePatterns.reduce((total, pattern) => total + countMatches(normalized, pattern), 0)
  const humanSignalHits = humanSignalPatterns.reduce((total, pattern) => total + countMatches(normalized, pattern), 0)
  const fourCharHits = countFourCharPhrases(normalized)

  // v2.0: 虚词密度 + n-gram 复现率（直接计算）
  const cleanedText = normalized.replace(/\s/g, '')
  const functionWords = '的了着过把被对于在在和与等跟从向沿着朝着按照凭靠根据关于由于为了除了比同跟和或及以及不但因为所以虽然但是如果然而而且因此'
  const functionWordCount = cleanedText.split('').filter((c) => functionWords.includes(c)).length
  const functionWordRatio = cleanedText.length > 0 ? functionWordCount / cleanedText.length : 0

  // n-gram 3-gram 复现率
  let trigramRepeatRatio = 0
  if (cleanedText.length > 3) {
    const triCounts = {}
    for (let i = 0; i <= cleanedText.length - 3; i++) {
      const tri = cleanedText.substring(i, i + 3)
      triCounts[tri] = (triCounts[tri] || 0) + 1
    }
    const triTotal = Object.values(triCounts).reduce((a, b) => a + b, 0)
    let repeatCount = 0
    Object.values(triCounts).forEach((count) => {
      if (count > 1) repeatCount += count
    })
    trigramRepeatRatio = triTotal > 0 ? repeatCount / triTotal : 0
  }

  // v2.1: 词级 N-gram 重复率（2-gram 和 3-gram）
  const wordBigramRepeat = wordLevelNgramRepetition(normalized, 2)
  const wordTrigramRepeat = wordLevelNgramRepetition(normalized, 3)

  // ============================================================
  // v3.0 重平衡: 总分计算公式
  //
  // 设计原则:
  // 1. 低基线（8分）— 干净文本不应自动获得高分
  // 2. "实质 > 形式" — 具体细节/人称信号 > 模板匹配
  // 3. 体裁感知 — 不同类型的文本使用不同阈值
  // 4. 上下文感知 — 判断句式是被"使用"还是被"讨论"
  // ============================================================
  // --- 体裁参数: 用户选择 + 自动检测互补 ---
  const userType = options.articleType || '通用文本'
  const TYPE_PARAMS = {
    '通用文本': { baseline: 8, patternMul: 2.0, concreteThreshold: 1, humanMul: 1.0, funcWordThreshold: 0.13 },
    '论文/作业': { baseline: 10, patternMul: 1.5, concreteThreshold: 0, humanMul: 0.8, funcWordThreshold: 0.15 },
    '公众号文章': { baseline: 6, patternMul: 2.3, concreteThreshold: 2, humanMul: 0.9, funcWordThreshold: 0.12 },
    '小红书笔记': { baseline: 4, patternMul: 1.8, concreteThreshold: 1, humanMul: 1.2, funcWordThreshold: 0.11 },
  }
  const params = TYPE_PARAMS[userType] || TYPE_PARAMS['通用文本']
  let score = params.baseline

  // --- v3.0 新: 体裁检测 & 上下文数据预计算 ---
  const genre = detectGenre(normalized)
  const lenStats = getSentenceLengthStd(sentences)
  const concreteDensity = getConcreteDensity(concreteHits, wordCount)
  // "比如" 单独计算——它是举例词，不算强人类信号
  const biRuCount = (normalized.match(/比如/g) || []).length

  // --- 加分项（AI 信号） ---
  // 1) 句式命中: 使用上下文感知后的 contextScore
  let patternTotalScore = wholeHits.details.reduce((sum, d) => sum + (d.contextScore || d.count * d.weight), 0)
  score += Math.min(Math.round(patternTotalScore * params.patternMul), 45)

  // 2) 句长特征: 仅极端长句
  if (averageSentenceLength > 42) score += 4
  if (averageSentenceLength > 56) score += 3

  // 3) 句长方差（burstiness proxy）
  if (variance < 0.22 && sentences.length >= 8) score += 5

  // 4) 字符去重比率
  if (uniqueRatio < 0.24 && wordCount > 400) score += 4

  // 5) 四字短语
  if (fourCharHits > 2) score += Math.min(8, fourCharHits * 1.5)

  // 6) 虚词密度
  if (wordCount > 150 && functionWordRatio > params.funcWordThreshold) {
    score += Math.min(4, Math.round((functionWordRatio - params.funcWordThreshold) * 200))
  }

  // 7-9) n-gram 特征（不变）
  if (wordCount > 200 && trigramRepeatRatio > 0.28) {
    score += Math.min(3, Math.round((trigramRepeatRatio - 0.28) * 30))
  }
  if (wordCount > 200 && wordBigramRepeat > 0.30) {
    score += Math.min(5, Math.round((wordBigramRepeat - 0.30) * 25))
  }
  if (wordCount > 200 && wordTrigramRepeat > 0.18) {
    score += Math.min(3, Math.round((wordTrigramRepeat - 0.18) * 25))
  }

  // 10) 缺少具体细节
  if (wordCount > 300 && concreteHits <= params.concreteThreshold) score += 4
  if (wordCount > 200 && concreteHits <= 0) score += 5

  // --- 扣分项（人类信号） ---
  // 11) 人类信号扣分（分级权重）
  // 强人声（第一人称经验）：我记得、我觉得、我见过 → 高权重
  // 普通人声（举例词、时间词）：比如、当时、今天 → 低权重
  const strongVoice = (normalized.match(/(我记得|我觉得|我感觉|我见过|我遇到|说实话|坦白讲|举个例子)/g) || []).length
  const weakVoice = (normalized.match(/(比如|当时|后来|最近|今天|有一次|那天|有次)/g) || []).length
  const totalSelfMatches = (normalized.match(/自我/g) || []).length
  const adjustedStrongVoice = Math.max(0, strongVoice)
  const adjustedWeakVoice = Math.max(0, weakVoice - totalSelfMatches)
  
  const effectiveHumanScore = adjustedStrongVoice * 3 + Math.round(adjustedWeakVoice * 0.5)
  if (effectiveHumanScore > 0) {
    score -= Math.min(15, Math.round(effectiveHumanScore * 2 * params.humanMul))
  }

  // 12) 具体事实扣分（按数量阶梯，不加cap）
  // concreteHits 越高 → 扣分越多，但不算"人类"信号而是"具体性"信号
  // 32(你的) 15分 vs 66(DeepSeek) 15分 → 再增加高级阶梯
  if (concreteHits >= 40) score -= 18
  else if (concreteHits >= 30) score -= 14
  else if (concreteHits >= 20) score -= 10
  else if (concreteHits >= 10) score -= 7
  else if (concreteHits >= 5) score -= 4
  else if (concreteHits >= 2) score -= 2

  // 如果文本同时有具体细节 AND 人类信号但被误判为 AI → 减分
  const patternCount = wholeHits.details.length
  if (concreteHits > 0 && effectiveHumanScore > 0 && patternCount > 0) {
    const ratio = (concreteHits + effectiveHumanScore / 5) / patternCount
    if (ratio > 3) score -= 5
    else if (ratio > 1.5) score -= 3
  }

  // 防冻结下限
  if (score < 5) score = 5

  // ============================================================
  // v3.0: 语义级检测融合（零外部依赖，纯JS）
  // 基于困惑度 + 过渡平滑度 + 词汇多样性曲线
  // ============================================================
  let semanticAnalysis = null
  if (wordCount > 100) {
    try {
      semanticAnalysis = analyzeSemantic(normalized)
      const semanticScore = Math.round(semanticAnalysis.overallScore / 2) // 归一化到0-50
      // 语义得分权重：30%
      score = Math.round(score * 0.70 + semanticScore * 0.30)
    } catch (error) {
      semanticAnalysis = null
    }
  }

  // ============================================================
  // v2.0: 上下文语义一致性检测（段落断层/观点矛盾/论据重复）
  // ============================================================
  let consistencyAnalysis = null
  if (paragraphsText.length >= 2) {
    try {
      consistencyAnalysis = analyzeConsistency(normalized)
      if (consistencyAnalysis.score > 30) {
        score += Math.min(6, Math.round(consistencyAnalysis.score * 0.06))
      }
    } catch (e) {
      consistencyAnalysis = null
    }
  }

  // ============================================================
  // v2.0: 场景检测权重增强
  // ============================================================
  const SCENE_BOOST = {
    '论文/作业': { patternsMul: 1.3, templateMul: 1.2 },
    '公众号文章': { patternsMul: 1.2, templateMul: 1.3 },
    '小红书笔记': { patternsMul: 1.1, templateMul: 1.4 },
  }
  const sceneBoost = SCENE_BOOST[userType]
  if (sceneBoost && wholeHits.score > 0) {
    const boost = wholeHits.score * (sceneBoost.patternsMul - 1) * 0.5
    score += Math.min(8, Math.round(boost))
  }

  // ============================================================
  // v3.0: 本地检测器融合（降低权重，减少误判）
  // ============================================================
  let localDetection = null
  try {
    localDetection = localDetector.detectLocal(normalized, { include_heatmap: true, threshold: 0.5 })
    const localScore = Math.round((localDetection.overall_ai_score || 0) * 100)

    // 减小本地检测权重，避免 n-gram 特征导致误判
    // 极短文本的统计特征不可靠，直接跳过融合
    if (wordCount < 80) { score = Math.round(score); localDetection = null; }
    const baseBlendWeight = wordCount < 80 ? 0 : 0.20
    const agreement = localDetection.metadata?.detector_agreement ?? 1
    const adjustedWeight = baseBlendWeight * (0.8 + 0.2 * agreement)

    score = Math.round(score * (1 - adjustedWeight) + localScore * adjustedWeight)
  } catch (error) {
    localDetection = null
  }
  score = clamp(Math.round(score), 3, 96)

  // ============================================================
  // 段落级分析
  // ============================================================
  const paragraphs = paragraphsText.map((paragraph, index) => {
    const hit = collectPatternHits(paragraph)
    const pSentences = splitSentences(paragraph)
    const pAvg = pSentences.length ? pSentences.reduce((sum, item) => sum + item.length, 0) / pSentences.length : paragraph.length
    let pScore = 20 + Math.round(hit.score * 1.6)
    if (pAvg > 42) pScore += 9
    if (countParallelismHits(paragraph) > 0) pScore += 10
    if (paragraph.length > 180 && concretePatterns.reduce((total, pattern) => total + countMatches(paragraph, pattern), 0) === 0) pScore += 8
    pScore = clamp(Math.round(pScore), 8, 96)
    const risk = classifyRisk(pScore)
    const labels = hit.details.map((item) => item.label).slice(0, 3)
    return {
      index: index + 1,
      order: index + 1,
      text: paragraph,
      preview: paragraph.length > 76 ? `${paragraph.slice(0, 76)}...` : paragraph,
      score: pScore,
      risk: risk.riskText,
      riskClass: risk.riskClass,
      riskRank: risk.rank,
      reasons: labels.length ? labels : ['抽象表达偏多'],
      suggestion: makeSuggestion(labels),
    }
  }).sort((a, b) => b.riskRank - a.riskRank || a.order - b.order)

  let issues = buildIssues(paragraphs.map((item) => ({ ...item, index: item.order })))
  const risk = classifyRisk(score)
  const sourceAnalysis = wholeHits.details.slice(0, 5).map((item) => ({
    title: item.label,
    desc: `${item.type}命中 ${item.count} 次，容易让文章显得规整但缺少真实语境。`,
    count: item.count,
    riskClass: item.weight >= 7 ? 'high' : item.weight >= 5 ? 'medium' : 'low',
  }))
  if (wordCount > 300 && concreteHits <= 1) {
    sourceAnalysis.push({ title: '缺少具体细节', desc: '数据、时间、人物、引用或亲历信息偏少。', count: 1, riskClass: 'medium' })
  }

  // v2.0: 虚词密度偏高提示（仅对长文本）
  if (wordCount > 150 && functionWordRatio > 0.10) {
    sourceAnalysis.push({
      title: '虚词密度偏高',
      desc: `虚词占比 ${(functionWordRatio * 100).toFixed(1)}%，可能因结构导向表达过多。`,
      count: 1,
      riskClass: functionWordRatio > 0.12 ? 'high' : 'medium',
    })
  }

  // v2.0: trigram 复现率提示（仅对长文本）
  if (wordCount > 150 && trigramRepeatRatio > 0.22) {
    sourceAnalysis.push({
      title: '字符序列复现率高',
      desc: `文本 ${(trigramRepeatRatio * 100).toFixed(1)}% 的连续字符组存在重复，是 AI 生成文本的常见特征。`,
      count: 1,
      riskClass: trigramRepeatRatio > 0.28 ? 'high' : 'medium',
    })
  }

  // v2.1: 词级 bigram 重复率提示
  if (wordCount > 100 && wordBigramRepeat > 0.28) {
    sourceAnalysis.push({
      title: '词级模式重复',
      desc: `词级 2-gram 重复率 ${(wordBigramRepeat * 100).toFixed(1)}%，AI 文本中常见的短语结构反复出现。`,
      count: 1,
      riskClass: wordBigramRepeat > 0.35 ? 'high' : 'medium',
    })
  }

  if (localDetection && localDetection.metadata && localDetection.metadata.component_scores) {
    const component = localDetection.metadata.component_scores
    if (component.statistical >= 0.62) {
      sourceAnalysis.push({
        title: '统计分布偏规整',
        desc: '熵值、突发系数、词频分布等本地检测特征显示文本节奏偏稳定。',
        count: 1,
        riskClass: component.statistical >= 0.78 ? 'high' : 'medium',
      })
    }
    if (component.semantic >= 0.56) {
      sourceAnalysis.push({
        title: '语义过渡偏平滑',
        desc: '相邻句之间的词汇和语义衔接过于稳定，容易显得像机器生成。',
        count: 1,
        riskClass: component.semantic >= 0.7 ? 'high' : 'medium',
      })
    }
  }
  // v2.0: 语义一致性分析
  let consistencyIssues = []
  if (consistencyAnalysis && consistencyAnalysis.issues.length > 0) {
    consistencyIssues = consistencyAnalysis.issues.map((item, idx) => ({
      id: `consistency-${idx}`,
      type: 'consistency',
      paragraphIndex: item.fromParagraph - 1,
      order: idx + 1,
      text: '',
      score: consistencyAnalysis.score,
      labels: [item.type === 'semantic_gap' ? '语义断层' : item.type === 'contradiction' ? '观点矛盾' : '论据重复'],
      risk: item.severity === 'high' ? '高风险' : '中风险',
      riskClass: item.severity,
      riskRank: item.severity === 'high' ? 3 : 2,
      problem: item.desc,
      suggestion: '',
      expanded: false,
    }))
    sourceAnalysis.push({
      title: '语义连贯性不足',
      desc: `存在 ${consistencyAnalysis.issues.length} 处语义一致性问题（断层 ${consistencyAnalysis.gapCount} 处、矛盾 ${consistencyAnalysis.contradictionCount} 处、重复 ${consistencyAnalysis.redundancyCount} 处）。`,
      count: consistencyAnalysis.issues.length,
      riskClass: consistencyAnalysis.score > 40 ? 'high' : 'medium',
    })
  }

  if (!issues.length && sourceAnalysis.length && paragraphs.length) {
    const paragraph = paragraphs[0]
    const fallbackSentence = splitSentences(paragraph.text)[0] || paragraph.text
    const issueRisk = classifyRisk(Math.max(score, paragraph.score || 0))
    issues = [{
      id: `${paragraph.order || paragraph.index}-fallback`,
      paragraphIndex: paragraph.order || paragraph.index,
      order: 1,
      text: fallbackSentence,
      score: Math.max(score, paragraph.score || 0),
      labels: sourceAnalysis.map((item) => item.title).slice(0, 4),
      risk: issueRisk.riskText,
      riskClass: issueRisk.riskClass,
      riskRank: issueRisk.rank,
      problem: `对应AI痕迹分析：${sourceAnalysis.map((item) => item.title).slice(0, 3).join('、')}。`,
      suggestion: '补充更具体的场景、事实、人物动作或个人判断依据。',
      example: optimizeSentence(fallbackSentence) || fallbackSentence,
      expanded: false,
    }]
  }

  const reasons = []
  if (wholeHits.details.length) reasons.push(`命中 ${wholeHits.details.length} 类AI味句式信号`)
  if (countParallelismHits(normalized)) reasons.push('存在排比或相似句式连续堆叠')
  if (averageSentenceLength > 34) reasons.push('平均句长偏长，阅读节奏较机械')
  if (wordCount > 300 && concreteHits <= 1) reasons.push('具体事实和个人经验密度偏低')
  // v2.0: 补充虚词和复现率提示（仅长文本）
  if (wordCount > 150 && functionWordRatio > 0.10) reasons.push(`虚词（的、了、在、对等）占比偏高（${(functionWordRatio * 100).toFixed(1)}%）`)
  if (wordCount > 150 && trigramRepeatRatio > 0.22) reasons.push(`字符序列复现率偏高（${(trigramRepeatRatio * 100).toFixed(1)}%）`)
  // v2.1: 词级 N-gram 重复提示
  if (wordCount > 100 && wordBigramRepeat > 0.28) reasons.push(`词级短语结构重复率偏高（${(wordBigramRepeat * 100).toFixed(1)}%）`)
  // v2.0: 语义一致性提示
  if (consistencyAnalysis && consistencyAnalysis.gapCount > 0) reasons.push(`存在 ${consistencyAnalysis.gapCount} 处语义断层`)
  if (consistencyAnalysis && consistencyAnalysis.contradictionCount > 0) reasons.push(`存在 ${consistencyAnalysis.contradictionCount} 处观点矛盾`)
  if (!reasons.length) reasons.push('未发现明显高频AI句式，建议继续人工复核')

  // v2.0: 置信度增强估计
  // 基于信号强度和一致性
  const signalDensity = wholeHits.details.length + (averageSentenceLength > 34 ? 1 : 0) + (variance < 0.32 ? 1 : 0)
  const hasStrongSignals = score >= 50
  const consistencyBonus = localDetection?.metadata?.detector_agreement
    ? Math.round(localDetection.metadata.detector_agreement * 20)
    : 0
  const confidenceScore = wordCount < 100 ? '较低' : wordCount < 300 ? '中等' : '较高'
  const confidenceDescription = wordCount < 100
    ? '文本较短，检测信号不足，建议提供更多文本以获得更可靠结果。'
    : hasStrongSignals && consistencyBonus > 10
      ? '多个检测维度信号一致，结果可靠性较高。'
      : '检测基于本地统计与模式匹配，建议结合人工判断。'

  return {
    id: `analysis_${Date.now()}`,
    text: normalized,
    title: options.title || (sentences[0] ? sentences[0].slice(0, 18) : '未命名文章'),
    articleType: options.articleType || '通用文本',
    score,
    beforeScore: score,
    probability: score,
    confidence: confidenceScore,
    confidenceDescription, // v2.0 新增
    wordCount,
    paragraphCount: paragraphsText.length,
    sentenceCount: sentences.length,
    aiFlavorHits: wholeHits.details.reduce((sum, item) => sum + item.count, 0),
    aiFlavorDetails: wholeHits.details.slice(0, 8),
    sourceAnalysis,
    paragraphs,
    issues: consistencyIssues.length ? issues.concat(consistencyIssues) : issues,
    highRiskSentences: issues.slice(0, 8),
    reasons,
    semanticConsistency: consistencyAnalysis ? {
      score: consistencyAnalysis.score,
      gapCount: consistencyAnalysis.gapCount,
      contradictionCount: consistencyAnalysis.contradictionCount,
      redundancyCount: consistencyAnalysis.redundancyCount,
      issues: consistencyIssues.slice(0, 10),
    } : null,
    // v2.0 扩展: 新增检测元数据
    featureDetails: {
      functionWordRatio: Number((functionWordRatio * 100).toFixed(1)),
      trigramRepeatRatio: Number((trigramRepeatRatio * 100).toFixed(1)),
      concreteHits,
      humanSignalHits,
      fourCharHits,
      sentenceVariance: Number(variance.toFixed(3)),
      // v2.1 新增
      wordBigramRepeat: Number((wordBigramRepeat * 100).toFixed(1)),
      wordTrigramRepeat: Number((wordTrigramRepeat * 100).toFixed(1)),
    },
    detector: localDetection ? {
      mode: 'local-js-ensemble',
      version: localDetection.metadata?.version || '2.0.0-local',
      overallScore: localDetection.overall_ai_score,
      confidence: localDetection.confidence,
      confidenceInterval: localDetection.confidence_interval,
      componentScores: localDetection.metadata.component_scores,
      detectorAgreement: localDetection.metadata.detector_agreement,
      heatmapData: localDetection.heatmap_data || [],
      statisticalFeatures: localDetection.metadata.statistical_features,
      semanticFeatures: localDetection.metadata.deep_learning_features,
    } : null,
    semanticAnalysis: semanticAnalysis ? {
      overallScore: semanticAnalysis.overallScore,
      components: {
        perplexity: {
          score: semanticAnalysis.components.perplexity.score,
          avgPPL: semanticAnalysis.components.perplexity.avgPPL,
          stdPPL: semanticAnalysis.components.perplexity.stdPPL,
        },
        smoothness: {
          score: semanticAnalysis.components.smoothness.score,
          avgSimilarity: semanticAnalysis.components.smoothness.avgSimilarity,
        },
        variety: {
          score: semanticAnalysis.components.variety.score,
        },
      },
    } : null,
    createdAt: Date.now(),
    ...risk,
  }
}

module.exports = {
  analyzeArticle,
  collectPatternHits,
  classifyRisk,
  splitParagraphs,
  // v2.1 新增导出（便于测试）
  pseudoTokenize,
  wordLevelNgramRepetition,
  // v3.0 新增导出
  detectGenre,
  getSentenceLengthStd,
  getConcreteDensity,
  isHumanNotButContext,
  isConceptUsedNaturally,
}
