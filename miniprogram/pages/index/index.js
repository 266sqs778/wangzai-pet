Page({
  data: {
    status: 'ok',
  },
  onLoad() {
    this.setData({ status: 'ok' });
  },
  goCustomize() {
    wx.navigateTo({ url: '/pages/customize/customize' });
  },
  goPreview() {
    wx.navigateTo({ url: '/pages/preview/preview' });
  },
  goGuide() {
    wx.navigateTo({ url: '/pages/guide/guide' });
  },
  onShareAppMessage() {
    return {
      title: '把你家宠物，带到电脑桌面陪伴你',
      path: '/pages/index/index',
    };
  },
});
