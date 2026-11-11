const C = require('../../config.js');

Page({
  data: {
    cfg: C.loadConfig(),
    species: C.SPECIES,
    draftLine: '',
  },
  onLoad() {
    this.setData({ cfg: C.loadConfig() });
  },
  pickSpecies(e) {
    this.setData({ 'cfg.species': e.currentTarget.dataset.key });
  },
  onName(e) {
    this.setData({ 'cfg.name': e.detail.value });
  },
  onDraft(e) {
    this.setData({ draftLine: e.detail.value });
  },
  onSize(e) {
    this.setData({ 'cfg.size': e.detail.value });
  },
  onSpeed(e) {
    this.setData({ 'cfg.speed': e.detail.value });
  },
  onAuto(e) {
    this.setData({ 'cfg.auto': e.detail.value });
  },
  onTop(e) {
    this.setData({ 'cfg.topmost': e.detail.value });
  },
  addLine() {
    const v = (this.data.draftLine || '').trim();
    if (!v) {
      wx.showToast({ title: '先写一句话', icon: 'none' });
      return;
    }
    const lines = this.data.cfg.lines.concat([v.slice(0, 30)]);
    if (lines.length > 12) lines.shift();
    this.setData({ 'cfg.lines': lines, draftLine: '' });
  },
  removeLine(e) {
    const i = Number(e.currentTarget.dataset.index);
    const lines = this.data.cfg.lines.slice();
    lines.splice(i, 1);
    this.setData({ 'cfg.lines': lines });
  },
  save() {
    const cfg = Object.assign({}, this.data.cfg);
    cfg.name = (cfg.name || '').trim() || '望崽';
    C.saveConfig(cfg);
    wx.navigateTo({ url: '/pages/preview/preview' });
  },
  reset() {
    const fresh = Object.assign({}, C.DEFAULT_CONFIG, { lines: C.DEFAULT_CONFIG.lines.slice() });
    C.saveConfig(fresh);
    this.setData({ cfg: fresh, draftLine: '' });
    wx.showToast({ title: '已恢复默认', icon: 'none' });
  },
});
