// 运行配置
// 路径 A（当前）：纯本地检测，无需后端
// 路径 B：需部署检测 API（中文模型 / SVM），设 enableRemoteDetect=true 并填写 HTTPS 地址
module.exports = {
  enableRemoteDetect: false,
  remoteDetectUrl: '',
  remoteDetectTimeoutMs: 3000,
  remoteWeight: 0.6,
}
