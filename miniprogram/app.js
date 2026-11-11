const config = require('./config.js');

App({
  globalData: {
    appName: '灯灯桌宠',
    site: config.SITE_BASE,
  },
  onLaunch() {
    // 配置保存在本机 storage，不上传、不需要登录。
  },
});
