/* 只需改这里：把网站换成你自己部署的域名与分享码即可。 */
const SITE_BASE = 'https://dengdeng-pet-07104.app.workbuddy.host/';
const SHARE_CODE = 'G672SI7TFH';

const SPECIES = [
  { key: 'cat', emoji: '🐈', label: '虎斑猫' },
  { key: 'orange', emoji: '🐈', label: '橘猫' },
  { key: 'dog', emoji: '🐕', label: '金毛' },
  { key: 'rabbit', emoji: '🐇', label: '兔子' },
  { key: 'chinchilla', emoji: '🐭', label: '龙猫' },
  { key: 'hamster', emoji: '🐹', label: '仓鼠' },
  { key: 'bird', emoji: '🐦', label: '小鸟' },
];

const DEFAULT_CONFIG = {
  name: '灯灯',
  species: 'cat',
  size: 220,
  speed: 2,
  auto: true,
  topmost: true,
  lines: ['在呢，一直都在。', '今天也要好好工作呀～', '摸摸我就有精神啦！', '别忘了喝水哦。'],
};

function loadConfig() {
  try {
    const saved = wx.getStorageSync('petConfig');
    if (saved && saved.name) return Object.assign({}, DEFAULT_CONFIG, saved);
  } catch (e) {}
  return Object.assign({}, DEFAULT_CONFIG, { lines: DEFAULT_CONFIG.lines.slice() });
}

function saveConfig(c) {
  try { wx.setStorageSync('petConfig', c); } catch (e) {}
}

function speciesLabel(key) {
  for (let i = 0; i < SPECIES.length; i++) {
    if (SPECIES[i].key === key) return SPECIES[i].label;
  }
  return '虎斑猫';
}

/* 小程序生成的链接与网页定制台共用同一套 URL 参数 */
function buildShareUrl(c) {
  const parts = [
    'sharecode=' + SHARE_CODE,
    's=' + encodeURIComponent(c.species || 'cat'),
    'n=' + encodeURIComponent(c.name || '灯灯'),
    'z=' + (c.size || 220),
    'v=' + (c.speed || 2),
    'a=' + (c.auto ? 1 : 0),
    't=' + (c.topmost ? 1 : 0),
    'l=' + encodeURIComponent((c.lines || []).join('|')),
  ];
  return SITE_BASE + '?' + parts.join('&');
}

function buildOpenUrl(c) {
  return SITE_BASE + '?sharecode=' + SHARE_CODE;
}

module.exports = {
  SITE_BASE,
  SHARE_CODE,
  SPECIES,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  speciesLabel,
  buildShareUrl,
  buildOpenUrl,
};
