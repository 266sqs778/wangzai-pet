/* Wangzai Pet Paradise · public customiser
   Everything runs in the visitor's browser. The export is a self-contained
   Windows desktop-pet package; no backend, no upload, no tracking. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // Every species exposes the full ACTION_INDEX set (idle/walk/stretch/groom/sleep)
  // so pressing an action always shows a distinct pose instead of clamping to
  // idle or, worse, falling back to sleep. Cartoon poses are derived by
  // generate_action_frames.py; see CHANGELOG.md for v1.1.0.
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

  /* ---------------- sound feedback (Web Audio, no files) ---------------- */
  /* Tiny synthesised blips so interactions feel alive without shipping any
     audio or making a network request. Users can mute via #sfxToggle. */
  const sfx = (() => {
    let enabled = true;
    let ctx = null;
    try { enabled = localStorage.getItem('wz-sfx') !== 'off'; } catch (_) {}
    function ac() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(freq, dur, type = 'sine', vol = 0.05, delay = 0) {
      if (!enabled) return;
      const c = ac();
      if (!c) return;
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
    const api = {
      isEnabled: () => enabled,
      toggle() {
        enabled = !enabled;
        try { localStorage.setItem('wz-sfx', enabled ? 'on' : 'off'); } catch (_) {}
        if (enabled) api.happy();
        return enabled;
      },
      tap()    { tone(520, 0.09, 'sine', 0.05); },
      happy()  { tone(620, 0.10, 'sine', 0.05); tone(880, 0.14, 'sine', 0.045, 0.09); },
      action() { tone(440, 0.08, 'triangle', 0.045); tone(660, 0.10, 'triangle', 0.04, 0.07); },
      done()   { tone(523, 0.10, 'sine', 0.05); tone(659, 0.10, 'sine', 0.05, 0.10); tone(784, 0.16, 'sine', 0.05, 0.20); },
    };
    return api;
  })();

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
    el.classList.add('is-show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-show'), 2600);
  }

  /* ---------------- motion helpers ---------------- */
  function setOverlay(el, open) {
    if (open) {
      clearTimeout(el._hideT);
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('is-open'));
    } else {
      el.classList.remove('is-open');
      clearTimeout(el._hideT);
      el._hideT = setTimeout(() => {
        if (!el.classList.contains('is-open')) el.hidden = true;
      }, 240);
    }
  }

  const _observed = new WeakSet();
  function observeReveals() {
    const els = Array.from(document.querySelectorAll('.reveal')).filter(
      (el) => !el.classList.contains('is-visible') && !_observed.has(el)
    );
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: .08 });
    els.forEach((el) => { _observed.add(el); io.observe(el); });
  }

  /* ---------------- preview ---------------- */
  function renderPreview(action) {
    const src = currentSrc(action);
    const img = $('#previewPetImg');
    img.src = src;
    $('#consolePetImg').src = src;
    // A visitor's own photo has no frame sheet, so animate it with a transform
    // that mirrors the exported poses (stretch/lean). Built-in species already
    // swap to a real frame and therefore keep a neutral transform.
    img.style.transform = '';
    // Crossfade the swap. A transition retargets on rapid clicks; keyframes would restart.
    const petBox = $('#previewPet');
    petBox.classList.add('is-swapping');
    requestAnimationFrame(() => requestAnimationFrame(() => petBox.classList.remove('is-swapping')));
    if (state.species === 'my' && state.customUrl) {
      if (action === 'stretch') img.style.transform = 'scaleY(1.16) scaleX(.94) translateY(3%)';
      else if (action === 'groom') img.style.transform = 'rotate(11deg) scale(.96)';
      else if (action === 'walk') img.style.transform = 'rotate(4deg) scale(.98)';
      else if (action === 'happy') img.style.transform = 'scale(1.08)';
      setTimeout(() => { img.style.transform = ''; }, 900);
    }
    $('#previewTag').textContent = `${state.name} 在陪你`;
    const bubble = $('#previewBubble');
    bubble.textContent = ACTION_WORDS[action] || `${state.name} 来陪你啦`;
    bubble.classList.add('is-show');
    clearTimeout(bubble._t);
    bubble._t = setTimeout(() => bubble.classList.remove('is-show'), 2200);
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
      card.className = 'gallery-card reveal';
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
    observeReveals();
  }

  /* ---------------- console ---------------- */
  function openConsole() {
    $('#console').hidden = false;
    $('#consoleOverlay').hidden = false;
    // Trigger the slide-in transition on the next frame so it animates from
    // translateX(102%) to 0 (CSS keys off .is-open, not [hidden]).
    requestAnimationFrame(() => {
      $('#console').classList.add('is-open');
      $('#consoleOverlay').classList.add('is-open');
    });
    document.body.classList.add('console-open');
    if (new URLSearchParams(location.search).has('s')) {
      try { history.replaceState(null, '', location.pathname + '?sharecode=' + currentShareCode()); } catch (e) {}
    }
  }
  function closeConsole() {
    $('#console').classList.remove('is-open');
    $('#consoleOverlay').classList.remove('is-open');
    document.body.classList.remove('console-open');
    // Wait for the slide-out before hiding, otherwise the exit animation is cut.
    setTimeout(() => {
      if (!$('#console').classList.contains('is-open')) {
        $('#console').hidden = true;
        $('#consoleOverlay').hidden = true;
      }
    }, 400);
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
      if (state.drag && !state.drag.moved) { renderPreview('happy'); sfx.happy(); }
      state.drag = null;
      pet.classList.remove('is-dragging');
    });
  }

  /* ---------------- share link ---------------- */
  /* The hosting platform requires a sharecode on the FIRST visit, otherwise
     every subsequent asset request is blocked (403). Always carry it through
     generated links, and never strip it from the address bar. */
  const FALLBACK_SHARE_CODE = 'G672SI7TFH';
  function currentShareCode() {
    const sc = new URLSearchParams(location.search).get('sharecode');
    return sc || FALLBACK_SHARE_CODE;
  }
  function shareUrl() {
    const p = new URLSearchParams();
    p.set('sharecode', currentShareCode());
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
      const cfg = {
        name: state.name, species: state.species === 'my' ? 'my' : state.species,
        size: state.size, speed: state.speed, auto: state.auto,
        topmost: state.topmost, lines: state.lines,
        note: 'Generated by Wangzai Pet Paradise customiser',
      };
      const result = await PET_EXPORT.buildPackage({
        cfg,
        spriteNames: state.species === 'my' ? [] : (SPRITES[state.species] || SPRITES.cat),
        customCanvas: state.species === 'my' ? state.customCanvas : null,
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
      sfx.done();
    } catch (err) {
      toast('打包失败：' + (err && err.message ? err.message : '未知错误'));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  /* ---------------- photo upload ---------------- */
  function handlePhoto(file) {
    if (!file || !file.type.startsWith('image/')) return toast('请选择一张图片');
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        state.customCanvas = PET_PACK.sticker(im, 360);
        state.customUrl = state.customCanvas.toDataURL('image/png');
        $('#photoPreviewImg').src = state.customUrl;
        $('#photoPreview').hidden = false;
        $('#applyPhoto').disabled = false;
        toast('照片已在本机处理好，点「应用到预览」看看');
      };
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
      sfx.action();
    }));
    $$('.pose').forEach((b) => b.addEventListener('click', () => {
      state.action = b.dataset.action === 'stretch' ? 'stretch' : b.dataset.action === 'groom' ? 'groom' : 'idle';
      renderPreview(state.action);
      sfx.action();
      toast('这是网页预览，导出后它也会这些本领');
    }));

    const sfxBtn = $('#sfxToggle');
    if (sfxBtn) {
      const paint = () => { sfxBtn.textContent = sfx.isEnabled() ? '♪ 音效开' : '♪ 音效关'; };
      paint();
      sfxBtn.addEventListener('click', () => { sfx.toggle(); paint(); });
    }

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
    $('#applyPhoto').addEventListener('click', () => {
      if (!state.customUrl) return;
      state.species = 'my';
      $('#petSpecies').value = 'my';
      state.action = 'idle';
      renderPreview();
      toast('换成你家那只啦');
    });

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
      $('#photoPreview').hidden = true;
      $('#applyPhoto').disabled = true;
      $('#packNote').textContent = '「我的分享码」会把当前定制生成专属二维码，朋友扫码直接看到这只宠物。';
      applyState();
      toast('已恢复默认设置');
    });
  }

  /* ---------------- share QR + contact modal ---------------- */
  function qrDataUrl(text, size) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const cells = qr.getModuleCount();
    const quiet = 4, scale = Math.max(2, Math.floor(size / (cells + quiet * 2)));
    const total = (cells + quiet * 2) * scale;
    const cv = document.createElement('canvas');
    cv.width = total; cv.height = total;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = '#29231d';
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
      }
    }
    return cv.toDataURL('image/png');
  }

  function openQr() {
    const url = shareUrl();
    const name = state.name || '望崽';
    $('#qrTitle').textContent = '扫码看「' + name + '」这只桌宠';
    $('#qrCodeImg').src = qrDataUrl(url, 480);
    setOverlay($('#qrOverlay'), true);
  }
  function closeQr() { setOverlay($('#qrOverlay'), false); }

  function openContact() { setOverlay($('#contactOverlay'), true); }
  function closeContact() { setOverlay($('#contactOverlay'), false); }

  function bindQr() {
    $('#myQrBtn').addEventListener('click', openQr);
    $('#myQrBtnFoot').addEventListener('click', openQr);
    $('#contactBtn').addEventListener('click', openContact);
    const headerContact = $('#headerContactBtn');
    if (headerContact) headerContact.addEventListener('click', openContact);
    $('#closeQr').addEventListener('click', closeQr);
    $('#closeContact').addEventListener('click', closeContact);
    $('#qrOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeQr(); });
    $('#contactOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeContact(); });
    $('#copyQrLink').addEventListener('click', () => copyText(shareUrl()).then((ok) => toast(ok ? '定制链接已复制，发给朋友吧' : '复制失败，请手动复制地址栏')));
    $('#downloadQr').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = $('#qrCodeImg').src;
      a.download = 'wangzai-share-' + (state.name || 'wangzai') + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('二维码已保存，发到微信群/朋友圈就能引流');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeQr(); closeContact(); }
    });
  }

  function clock() {
    const d = new Date();
    $('#tbTime').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function init() {
    const dbgQr = new URLSearchParams(location.search).get('qr');
    renderGallery();
    observeReveals();
    bind();
    bindQr();
    initDrag();
    const restored = restoreFromUrl();
    applyState();
    clock();
    setInterval(clock, 30000);
    if (restored) {
      openConsole();
      toast('已还原朋友分享的定制');
    }
    if (dbgQr === '1') setTimeout(openQr, 400);
    if (dbgQr === 'contact') setTimeout(openContact, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
