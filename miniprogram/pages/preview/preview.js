const C = require('../../config.js');

function imageFor(species) {
  if (species === 'dog') return '/images/dog.png';
  if (species === 'rabbit') return '/images/rabbit.png';
  return '/images/cat.png';
}

Page({
  data: {
    cfg: {},
    shareUrl: '',
    plainUrl: '',
    speciesLabel: '',
    lineCount: 0,
    previewImage: '/images/cat.png',
  },
  onShow() {
    this.refresh();
  },
  refresh() {
    const cfg = C.loadConfig();
    this.setData({
      cfg: cfg,
      shareUrl: C.buildShareUrl(cfg),
      plainUrl: C.buildOpenUrl(cfg),
      speciesLabel: C.speciesLabel(cfg.species),
      lineCount: (cfg.lines || []).length,
      previewImage: imageFor(cfg.species),
    });
  },
  copyShare() {
    const that = this;
    wx.setClipboardData({
      data: that.data.shareUrl,
      success() { wx.showToast({ title: '已复制，发到电脑打开', icon: 'none' }); },
    });
  },
  copyPlain() {
    wx.setClipboardData({
      data: this.data.plainUrl,
      success() { wx.showToast({ title: '首页链接已复制', icon: 'none' }); },
    });
  },
  goCustomize() {
    wx.navigateTo({ url: '/pages/customize/customize' });
  },
  onShareAppMessage() {
    return {
      title: '我把自家宠物做成了桌面小伙伴，你也来领一只',
      path: '/pages/index/index',
    };
  },
});
