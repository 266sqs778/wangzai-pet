/* Wangzai Pet Paradise · public customiser
   Everything runs in the visitor's browser. The export is a self-contained
   Windows desktop-pet package; no backend, no upload, no tracking. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const SPRITES = {
    cat:        ['cat_idle', 'cat_walk', 'cat_stretch', 'cat_groom', 'cat_sleep'],
    orange:     ['orange_idle', 'cat_walk', 'cat_stretch', 'cat_groom', 'orange_sleep'],
    dog:        ['dog_idle', 'dog_walk', 'dog_stretch', 'dog_groom', 'dog_sleep'],
    rabbit:     ['rabbit_idle', 'rabbit_walk', 'rabbit_stretch', 'rabbit_groom', 'rabbit_sleep'],
    chinchilla: ['chinchilla_idle', 'chinchilla_walk', 'chinchilla_stretch', 'chinchilla_groom', 'chinchilla_sleep'],
    hamster:    ['hamster_idle', 'hamster_walk', 'hamster_stretch', 'hamster_groom', 'hamster_sleep'],
    bird:       ['bird_idle', 'bird_walk', 'bird_stretch', 'bird_groom', 'bird_sleep'],
    my:         ['my-pet'],
  };
  const NAMES = {
    cat: '虎斑猫', orange: '橘猫', dog: '金毛', rabbit: '兔子',
    chinchilla: '龙猫', hamster: '仓鼠', bird: '小鸟', my: '我家那只',
  };
  const ACTION_INDEX = { idle: 0, walk: 1, stretch: 2, groom: 3, sleep: 4, happy: 0, feed: 0, hello: 0 };
  const ACTION_WORDS = {
    idle: '在呢，一直都在。', walk: '出去溜达一圈～', stretch: '伸个懒腰！',
    groom: '舔舔毛毛，整理一下。', sleep: '困了，眯一会儿…', happy: '摸摸就有精神啦！',
    feed: '有零食！谢谢你～', hello: '喵，你叫我呀？',
  };
  const DEFAULT_LINES = [
    '在呢，一直都在。', '今天也要好好工作呀～', '摸摸我就有精神啦！',
    '你在忙吗？我陪着你。', '别忘了喝水哦。',
  ];

  const state = {
    name: '望崽', species: 'cat', size: 220, speed: 2,
    auto: true, topmost: true, lines: DEFAULT_LINES.slice(),
    action: 'idle', customCanvas: null, customUrl: '',
    syncGuard: false, drag: null, walkTimer: null,
  };

  const spriteFor = (species, action) => {
    const list = SPRITES[species] || SPRITES.cat;
    const idx = Math.min(ACTION_INDEX[action] ?? 0, list.length - 1);
    return list[idx];
  };
  const spriteSrc = (name) => `assets/pet/${name}.png`;

  function currentSrc(action) {
    if (state.species === 'my' && state.customUrl) return state.customUrl;
    return spriteSrc(spriteFor(state.species, action || state.action));
  }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  /* ---------------- preview ---------------- */
  function renderPreview(action) {
    const src = currentSrc(action);
    $('#previewPetImg').src = src;
    $('#consolePetImg').src = src;
    $('#previewTag').textContent = `${state.name} 在陪你`;
    const bubble = $('#previewBubble');
    bubble.textContent = ACTION_WORDS[action] || `${state.name} 来陪你啦`;
    bubble.classList.add('show');
    clearTimeout(bubble._t);
    bubble._t = setTimeout(() => bubble.classList.remove('show'), 2200);
  }

  function renderLines() {
    const box = $('#linesList');
    box.innerHTML = '';
    state.lines.forEach((line, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'line-chip';
      chip.textContent = line;
      chip.title = '点击移除';
      chip.addEventListener('click', () => {
        state.lines.splice(i, 1);
        renderLines();
      });
      box.appendChild(chip);
    });
    if (!state.lines.length) box.innerHTML = '<span class="lines-empty">还没有台词，加一句吧</span>';
  }

  function syncUI() {
    state.syncGuard = true;
    $('#petName').value = state.name;
    $('#petSpecies').value = state.species;
    $('#petSize').value = state.size;
    $('#petSpeed').value = state.speed;
    $('#petAuto').checked = state.auto;
    $('#petTopmost').checked = state.topmost;
    $('#sizeValue').textContent = state.size;
    $('#speedValue').textContent = state.speed;
    $('#previewPet').style.width = Math.min(state.size, 260) + 'px';
    state.syncGuard = false;
  }

  function applyState() {
    syncUI();
    renderLines();
    renderPreview(state.action);
  }

  /* ---------------- gallery ---------------- */
  const GALLERY = [
    { name: '虎斑猫 · 想事情', img: 'assets/cat-think-poster.webp', species: 'cat', tag: '最受欢迎' },
    { name: '橘猫 · 靠着休息', img: 'assets/home-process-cat.webp', species: 'orange', tag: '软乎乎' },
    { name: '虎斑猫 · 伸懒腰', img: 'assets/cat-stretch-poster.webp', species: 'cat', tag: '会动' },
    { name: '猫咪 · 舔毛毛', img: 'assets/cat-groom-poster.webp', species: 'cat', tag: '爱干净' },
    { name: '金毛 · 歪头杀', img: 'assets/dog-cheeks-720p.poster.webp', species: 'dog', tag: '狗狗' },
    { name: '虎斑猫 · 伸懒腰', img: 'assets/cat-stretch-720p.poster.webp', species: 'cat', tag: '经典' },
  ];

  function renderGallery() {
    const grid = $('#galleryGrid');
    grid.innerHTML = '';
    GALLERY.forEach((g) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'gallery-card';
      card.innerHTML = `<div class="gallery-media"><img src="${g.img}" alt="${g.name}" loading="lazy" /><span class="gallery-tag">${g.tag}</span></div><div class="gallery-meta"><b>${g.name}</b><span>免费定制 →</span></div>`;
      card.addEventListener('click', () => {
        state.species = g.species;
        state.action = 'idle';
        applyState();
        openConsole();
        toast(`已选 ${NAMES[g.species]}，可以再换成你家照片`);
      });
      grid.appendChild(card);
    });
  }

  /* ---------------- console ---------------- */
  function openConsole() {
    $('#console').hidden = false;
    $('#consoleOverlay').hidden = false;
    document.body.classList.add('console-open');
    if (new URLSearchParams(location.search).has('s')) {
      history.replaceState(null, '', location.pathname);
    }
  }
  function closeConsole() {
    $('#console').hidden = true;
    $('#consoleOverlay').hidden = true;
    document.body.classList.remove('console-open');
  }

  /* ---------------- drag preview ---------------- */
  function initDrag() {
    const pet = $('#previewPet');
    const screen = $('#desktopScreen');
    pet.addEventListener('pointerdown', (e) => {
      const pr = pet.getBoundingClientRect(), sr = screen.getBoundingClientRect();
      state.drag = {
        dx: e.clientX - pr.left, dy: e.clientY - pr.top,
        ox: parseFloat(pet.style.left || '0'), oy: parseFloat(pet.style.top || '0'),
        sr, moved: false,
      };
      pet.setPointerCapture(e.pointerId);
      pet.classList.add('is-dragging');
      pet.style.right = 'auto';
      pet.style.bottom = 'auto';
    });
    pet.addEventListener('pointermove', (e) => {
      if (!state.drag) return;
      const d = state.drag;
      const x = e.clientX - d.sr.left - d.dx;
      const y = e.clientY - d.sr.top - d.dy;
      pet.style.left = Math.max(0, Math.min(d.sr.width - pet.offsetWidth, x)) + 'px';
      pet.style.top = Math.max(0, Math.min(d.sr.height - pet.offsetHeight, y)) + 'px';
      d.moved = true;
    });
    pet.addEventListener('pointerup', () => {
      if (state.drag && !state.drag.moved) renderPreview('happy');
      state.drag = null;
      pet.classList.remove('is-dragging');
    });
  }

  /* ---------------- share link ---------------- */
  function shareUrl() {
    const p = new URLSearchParams();
    p.set('s', state.species === 'my' ? 'cat' : state.species);
    p.set('n', state.name);
    p.set('z', String(state.size));
    p.set('v', String(state.speed));
    p.set('a', state.auto ? '1' : '0');
    p.set('t', state.topmost ? '1' : '0');
    p.set('l', state.lines.join('|'));
    return location.origin + location.pathname + '?' + p.toString();
  }
  function restoreFromUrl() {
    const q = new URLSearchParams(location.search);
    if (!q.has('s')) return false;
    state.species = SPRITES[q.get('s')] ? q.get('s') : 'cat';
    state.name = (q.get('n') || '望崽').slice(0, 12);
    state.size = Math.max(100, Math.min(420, Number(q.get('z')) || 220));
    state.speed = Math.max(1, Math.min(8, Number(q.get('v')) || 2));
    state.auto = q.get('a') !== '0';
    state.topmost = q.get('t') !== '0';
    if (q.get('l')) state.lines = q.get('l').split('|').filter(Boolean).slice(0, 12);
    return true;
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    }
  }

  /* ---------------- export package ---------------- */
  async function exportPack() {
    const btn = $('#exportBtn');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '正在打包素材…';
    try {
      const usingPhoto = !!state.customCanvas;
      const cfg = {
        name: state.name, species: usingPhoto ? 'my' : state.species,
        size: state.size, speed: state.speed, auto: state.auto,
        topmost: state.topmost, lines: state.lines,
        note: 'Generated by Wangzai Pet Paradise customiser',
      };
      const result = await PET_EXPORT.buildPackage({
        cfg,
        spriteNames: usingPhoto ? [] : (SPRITES[state.species] || SPRITES.cat),
        customCanvas: usingPhoto ? state.customCanvas : null,
      });
      const count = result.count;
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wangzai-pet.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);

      $('#packNote').textContent = `已生成：${count} 张动作图 + 配置 + 运行时。解压后双击 start.bat，${state.name} 就上桌啦。`;
      toast('桌宠包已下载 · 解压后双击 start.bat');
    } catch (err) {
      toast('打包失败：' + (err && err.message ? err.message : '未知错误'));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  /* ---------------- photo upload ---------------- */
  function applyCustomPhoto() {
    if (!state.customCanvas) return;
    state.species = 'my';
    const sel = $('#petSpecies'); if (sel) sel.value = 'my';
    state.action = 'idle';
    renderPreview();
    $('#applyPhoto').disabled = true;
    toast('已换成你家那只 · 现在就能生成桌宠包');
  }
  function processPhoto(im) {
    state.photoImage = im;
    const removeBg = $('#removeBg') ? $('#removeBg').checked : true;
    const out = PET_PACK.preparePet(im, 360, removeBg);
    state.customCanvas = out.canvas;
    state.backgroundRemoved = out.backgroundRemoved;
    state.customUrl = state.customCanvas.toDataURL('image/png');
    $('#photoPreviewImg').src = state.customUrl;
    $('#photoPreview').hidden = false;
    applyCustomPhoto();
  }
  function handlePhoto(file) {
    if (!file || !file.type.startsWith('image/')) return toast('请选择一张图片');
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => processPhoto(im);
      im.onerror = () => toast('这张图读不出来，换一张试试');
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------------- bindings ---------------- */
  function bind() {
    $$('[data-open-console]').forEach((b) => b.addEventListener('click', openConsole));
    $('#openConsole').addEventListener('click', openConsole);
    $('#closeConsole').addEventListener('click', closeConsole);
    $('#consoleOverlay').addEventListener('click', closeConsole);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeConsole(); });

    $$('.chip').forEach((b) => b.addEventListener('click', () => {
      state.species = b.dataset.species;
      state.action = 'idle';
      applyState();
      openConsole();
      toast(`已选 ${NAMES[state.species]}`);
    }));

    $$('.action-btn').forEach((b) => b.addEventListener('click', () => {
      state.action = b.dataset.action;
      renderPreview(state.action);
    }));
    $$('.pose').forEach((b) => b.addEventListener('click', () => {
      state.action = b.dataset.action === 'stretch' ? 'stretch' : b.dataset.action === 'groom' ? 'groom' : 'idle';
      renderPreview(state.action);
      toast('这是网页预览，导出后它也会这些本领');
    }));

    $('#petName').addEventListener('input', (e) => {
      state.name = e.target.value.trim() || '望崽';
      $('#previewTag').textContent = `${state.name} 在陪你`;
    });
    $('#petSpecies').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'my' && !state.customUrl) {
        e.target.value = state.species;
        return toast('先上传一张照片，就能选「我家那只」');
      }
      state.species = v;
      state.action = 'idle';
      renderPreview();
    });
    $('#petSize').addEventListener('input', (e) => {
      state.size = Number(e.target.value);
      $('#sizeValue').textContent = state.size;
      $('#previewPet').style.width = Math.min(state.size, 260) + 'px';
    });
    $('#petSpeed').addEventListener('input', (e) => {
      state.speed = Number(e.target.value);
      $('#speedValue').textContent = state.speed;
    });
    $('#petAuto').addEventListener('change', (e) => { state.auto = e.target.checked; });
    $('#petTopmost').addEventListener('change', (e) => { state.topmost = e.target.checked; });

    $('#sayBtn').addEventListener('click', () => {
      const v = $('#sayText').value.trim();
      if (!v) return toast('先写一句想让它说的话');
      state.lines.push(v.slice(0, 30));
      if (state.lines.length > 12) state.lines.shift();
      $('#sayText').value = '';
      renderLines();
      renderPreview('hello');
      $('#previewBubble').textContent = v;
      toast('已加入台词表，导出后会随机说');
    });
    $('#sayText').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#sayBtn').click(); });

    $('#photoInput').addEventListener('change', (e) => handlePhoto(e.target.files[0]));
    const bgToggle = $('#removeBg');
    if (bgToggle) bgToggle.addEventListener('change', () => {
      if (state.photoImage) processPhoto(state.photoImage);
    });
    $('#applyPhoto').addEventListener('click', applyCustomPhoto);

    $('#exportBtn').addEventListener('click', exportPack);
    $('#importDesktop').addEventListener('click', () => { openConsole(); $('#exportBtn').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    $('#footerLaunch').addEventListener('click', () => { openConsole(); $('#exportBtn').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    $('#footerShare').addEventListener('click', () => copyText(shareUrl()).then((ok) => toast(ok ? '定制链接已复制，发给朋友吧' : '复制失败，请手动复制地址栏')));
    $('#shareBtn').addEventListener('click', () => copyText(shareUrl()).then((ok) => toast(ok ? '定制链接已复制，发给朋友吧' : '复制失败，请手动复制地址栏')));
    $('#toggleVisible').addEventListener('click', () => {
      const pet = $('#previewPet');
      pet.classList.toggle('is-hidden');
      toast(pet.classList.contains('is-hidden') ? '预览已收起' : '预览回来了');
    });
    $('#quitPet').addEventListener('click', () => {
      state.name = '望崽'; state.species = 'cat'; state.size = 220; state.speed = 2;
      state.auto = true; state.topmost = true; state.action = 'idle';
      state.lines = DEFAULT_LINES.slice(); state.customCanvas = null; state.customUrl = '';
      state.photoImage = null; state.backgroundRemoved = false;
      $('#photoPreview').hidden = true;
      $('#applyPhoto').disabled = true;
      $('#packNote').textContent = '包内文件名使用英文，避免解压乱码；中文说明见 README.txt。';
      applyState();
      toast('已恢复默认设置');
    });
  }

  function clock() {
    const d = new Date();
    $('#tbTime').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function init() {
    renderGallery();
    bind();
    initDrag();
    const restored = restoreFromUrl();
    applyState();
    clock();
    setInterval(clock, 30000);
    if (restored) {
      openConsole();
      toast('已还原朋友分享的定制');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
