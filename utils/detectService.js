const config = require('./config')
const { analyzeArticle } = require('./aiTextDetection')

function mergeRemoteScores(analysis, remote) {
  const remoteWeight = config.remoteWeight
  const localWeight = 1 - remoteWeight
  const remoteScore = remote.aiScore
  analysis.score = Math.round(analysis.score * localWeight + remoteScore * remoteWeight)
  analysis.svmScore = remoteScore
  analysis.svmVerdict = remote.verdict
  analysis.svmVotes = remote.perModelVotes
  analysis.svmElapsed = remote.elapsed
  analysis.fusionWeight = `本地${Math.round(localWeight * 100)}% + 云端${Math.round(remoteWeight * 100)}%`
  analysis.detectMode = 'fusion'
  return analysis
}

function requestRemoteDetect(text) {
  return new Promise((resolve) => {
    const baseUrl = (config.remoteDetectUrl || '').replace(/\/$/, '')
    if (!baseUrl) {
      resolve(null)
      return
    }

    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const timer = setTimeout(() => finish(null), config.remoteDetectTimeoutMs)

    wx.request({
      url: `${baseUrl}/detect`,
      method: 'POST',
      data: { text },
      header: { 'content-type': 'application/json' },
      success: (res) => {
        clearTimeout(timer)
        if (res.data && res.data.aiScore !== undefined) finish(res.data)
        else finish(null)
      },
      fail: () => {
        clearTimeout(timer)
        finish(null)
      },
    })
  })
}

/**
 * 检测编排：先本地分析，可选云端融合（由 config.enableRemoteDetect 控制）
 */
function runDetection(text, options = {}) {
  const analysis = analyzeArticle(text, options)
  analysis.originalText = text
  analysis.detectMode = 'local'

  if (!config.enableRemoteDetect || !config.remoteDetectUrl) {
    return Promise.resolve(analysis)
  }

  return requestRemoteDetect(text).then((remote) => {
    if (remote) return mergeRemoteScores(analysis, remote)
    return analysis
  })
}

module.exports = {
  runDetection,
}
