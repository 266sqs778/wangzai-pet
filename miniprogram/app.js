const config = require('./config.js');

App({
  globalData: {
    appName: '望崽宠乐园',
    site: config.SITE_BASE,
  },
  onLaunch() {
    // 配置保存在本机 storage，不上传、不需要登录。
  },
});
