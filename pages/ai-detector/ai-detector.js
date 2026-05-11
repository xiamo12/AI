// pages/ai-detector/ai-detector.js

const aiDetector = require('../../utils/aiDetector')

Page({
  data: {
    // 输入框内容
    inputText: '',
    
    // 检测结果
    result: null,
    isLoading: false,
    statusMessage: '',
    
    // UI状态
    hasResult: false,
    showDetails: false,
    
    // 服务状态
    serviceOnline: true,
    serverURL: aiDetector.getAPIURL(),
    
    // 历史记录
    history: [],
    maxHistoryItems: 10
  },

  onLoad() {
    console.log('AI Detector Page Loaded')
    this.checkServiceStatus()
    this.loadHistory()
  },

  /**
   * 检查AI检测服务是否在线
   */
  checkServiceStatus() {
    this.setData({ statusMessage: '正在初始化本地检测引擎...' })
    
    aiDetector.healthCheck(
      (res) => {
        this.setData({
          serviceOnline: true,
          statusMessage: '本地检测引擎已就绪'
        })
        console.log('Service Status:', res)
      },
      (error) => {
        this.setData({
          serviceOnline: false,
          statusMessage: '本地检测引擎异常 - ' + error.error
        })
        console.error('Service Error:', error)
      }
    )
  },

  /**
   * 输入框文本变化
   */
  onInputChange(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  /**
   * 检测文本
   */
  detectText() {
    const { inputText, serviceOnline } = this.data
    
    if (!inputText || inputText.trim().length === 0) {
      wx.showToast({
        title: '请输入文本',
        icon: 'error',
        duration: 2000
      })
      return
    }
    
    if (inputText.length > 50000) {
      wx.showToast({
        title: '文本过长（最多50000字符）',
        icon: 'error',
        duration: 2000
      })
      return
    }

    // 开始加载
    this.setData({
      isLoading: true,
      statusMessage: '正在本地分析...'
    })

    // 调用AI检测服务
    aiDetector.detect(
      inputText,
      (result) => {
        // 成功
        console.log('Detection Result:', result)
        this.setData({
          result: result,
          hasResult: true,
          isLoading: false,
          statusMessage: result.from_cache ? '✅ 检测完成（来自缓存）' : '✅ 检测完成'
        })
        
        // 添加到历史
        this.addToHistory({
          text: inputText.substring(0, 50) + (inputText.length > 50 ? '...' : ''),
          score: result.overall_ai_score,
          timestamp: new Date().getTime()
        })

        // 显示结果提示
        this.showResultToast(result)
      },
      (error) => {
        // 失败
        console.error('Detection Error:', error)
        this.setData({
          hasResult: false,
          isLoading: false,
          statusMessage: '❌ 检测失败：' + error.error
        })
        
        wx.showToast({
          title: '检测失败',
          icon: 'error',
          duration: 2000
        })
      },
      {
        include_heatmap: true,
        timeout: 30000
      }
    )
  },

  /**
   * 显示结果提示
   */
  showResultToast(result) {
    const score = (result.overall_ai_score * 100).toFixed(1)
    const isAI = result.is_ai_generated
    const message = isAI 
      ? `AI生成可能性: ${score}%` 
      : `人类写作可能性: ${(100 - score)}%`
    
    wx.showToast({
      title: message,
      icon: isAI ? 'info' : 'success',
      duration: 2000
    })
  },

  /**
   * 切换详细信息展示
   */
  toggleDetails() {
    this.setData({
      showDetails: !this.data.showDetails
    })
  },

  /**
   * 清空输入框和结果
   */
  clearAll() {
    this.setData({
      inputText: '',
      result: null,
      hasResult: false,
      showDetails: false,
      statusMessage: ''
    })
  },

  /**
   * 复制结果
   */
  copyResult() {
    const { result } = this.data
    if (!result) return
    
    const text = `AI检测结果：\nAI概率: ${(result.overall_ai_score * 100).toFixed(1)}%\n置信度: ${(result.confidence * 100).toFixed(1)}%\n95%置信区间: [${(result.confidence_interval.lower * 100).toFixed(1)}%, ${(result.confidence_interval.upper * 100).toFixed(1)}%]\n处理时间: ${result.processing_time_ms}ms`
    
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
          duration: 1000
        })
      }
    })
  },

  /**
   * 添加到历史记录
   */
  addToHistory(item) {
    const { history, maxHistoryItems } = this.data
    const newHistory = [item, ...history]
    
    if (newHistory.length > maxHistoryItems) {
      newHistory.pop()
    }
    
    this.setData({ history: newHistory })
    this.saveHistory()
  },

  /**
   * 保存历史记录到本地
   */
  saveHistory() {
    try {
      wx.setStorageSync('aiDetectorHistory', this.data.history)
    } catch (e) {
      console.error('Save history error:', e)
    }
  },

  /**
   * 加载历史记录
   */
  loadHistory() {
    try {
      const history = wx.getStorageSync('aiDetectorHistory') || []
      this.setData({ history })
    } catch (e) {
      console.error('Load history error:', e)
    }
  },

  /**
   * 清空历史记录
   */
  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有历史记录吗？',
      confirmText: '清空',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.setData({ history: [] })
          wx.removeStorageSync('aiDetectorHistory')
          wx.showToast({
            title: '已清空',
            icon: 'success',
            duration: 1000
          })
        }
      }
    })
  },

  /**
   * 从历史记录项中检测
   */
  detectFromHistory(e) {
    const index = e.currentTarget.dataset.index
    const historyItem = this.data.history[index]
    
    this.setData({
      inputText: historyItem.text
    })
    
    // 稍微延迟后执行检测
    setTimeout(() => {
      this.detectText()
    }, 200)
  },

  /**
   * 获取风险等级描述
   */
  getRiskDescription(score) {
    if (score > 0.7) return '⚠️ 很可能是AI生成'
    if (score > 0.5) return '⚠️ 可能是AI生成'
    if (score > 0.3) return '✅ 可能是人类写作'
    return '✅ 很可能是人类写作'
  },

  /**
   * 获取置信度描述
   */
  getConfidenceDescription(confidence) {
    if (confidence > 0.9) return '非常高'
    if (confidence > 0.7) return '高'
    if (confidence > 0.5) return '中等'
    return '低'
  },

  /**
   * 获取结果颜色
   */
  getResultColor(score) {
    if (score > 0.7) return '#FF6B6B'      // 红色 - AI
    if (score > 0.5) return '#FFA500'      // 橙色 - 可能AI
    if (score > 0.3) return '#4CAF50'      // 绿色 - 可能人类
    return '#2196F3'                       // 蓝色 - 人类
  }
})
