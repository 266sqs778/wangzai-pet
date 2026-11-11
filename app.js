/* ============ Dengdeng pet - homepage + remote console ============ */
(() => {
  'use strict';

  const API = location.protocol.startsWith('http') ? '' : 'http://127.0.0.1:8765';
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const SPECIES_LABEL = {
    cat: '虎斑猫', orange: '橘猫', dog: '金毛', rabbit: '兔子',
    chinchilla: '龙猫', hamster: '仓鼠', bird: '小鸟', my: '我家宠物',
  };
  const SPRITES = {
    cat:        {idle:'cat_idle', walk:'cat_walk', stretch:'cat_stretch', groom:'cat_groom', sleep:'cat_sleep', happy:'cat_idle'},
    orange:     {idle:'orange_idle', walk:'cat_walk', stretch:'cat_stretch', groom:'cat_groom', sleep:'orange_sleep', happy:'orange_idle'},
    dog:        {idle:'dog_idle', walk:'dog_walk', stretch:'dog_idle', groom:'dog_idle', sleep:'dog_sleep', happy:'dog_idle'},
    rabbit:     {idle:'rabbit_idle', walk:'rabbit_idle', stretch:'rabbit_idle', groom:'rabbit_idle', sleep:'rabbit_sleep', happy:'rabbit_idle'},
    chinchilla: {idle:'chinchilla_idle', walk:'chinchilla_idle', stretch:'chinchilla_idle', groom:'chinchilla_idle', sleep:'chinchilla_sleep', happy:'chinchilla_idle'},
    hamster:    {idle:'hamster_idle', walk:'hamster_idle', stretch:'hamster_idle', groom:'hamster_idle', sleep:'hamster_sleep', happy:'hamster_idle'},
    bird:       {idle:'bird_idle', walk:'bird_idle', stretch:'bird_idle', groom:'bird_idle', sleep:'bird_sleep', happy:'bird_idle'},
    my:         {idle:'my-pet', walk:'my-pet', stretch:'my-pet', groom:'my-pet', sleep:'my-pet', happy:'my-pet'},
  };
  const LINES = ['在呢，一直都在。', '今天也要好好工作呀～', '摸摸我就有精神啦！',
                 '你在忙吗？我陪着你。', '别忘了喝水哦。', '伸个懒腰，继续加油！'];

  const state = { online:false, running:false, config:null, species:'cat', action:'idle', uploaded:null };
  let toastTimer = null, walkAnim = null, bubbleTimer = null, configTimer = null, syncGuard = false;

  const toast = (msg) => {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-show'), 2600);
  };
  const spriteUrl = (stem) => `assets/pet/${stem}.png`;

  async function api(path, body) {
    const res = await fetch(API + path, body === undefined
      ? { cache:'no-store' }
      : { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  /* ---------------- gallery ---------------- */
  const GALLERY = [
    ['猪猪','cat'], ['黑豆','chinchilla'], ['猪猪','rabbit'], ["s'pa'de'r",'bird'],
    ['蛋卷','hamster'], ['虎子','dog'], ['土豆','rabbit'], ['大鹏','bird'],
    ['甜菜','orange'], ['腊肠','dog'], ['米小亖','chinchilla'], ['蛋黄','hamster'],
  ];
  $('#galleryGrid').innerHTML = GALLERY.map(([name, sp]) => `
    <button class="gallery-card" data-species="${sp}" data-name="${name}">
      <div class="gallery-card__art"><img src="${spriteUrl(SPRITES[sp].idle)}" alt="${name}" /></div>
      <div class="gallery-card__name">${name}</div>
      <div class="gallery-card__meta"><span>${SPECIES_LABEL[sp]}</span><em>看看全部本领 ↗</em></div>
    </button>`).join('');

  /* ---------------- preview pet ---------------- */
  const preview = $('#previewPet');
  const previewImg = $('#previewPetImg');
  const bubble = $('#previewBubble');
  const screen = $('#desktopScreen');

  function updatePreview(species, action) {
    const poses = SPRITES[species] || SPRITES.cat;
    previewImg.src = spriteUrl(poses[action] || poses.idle) + (species === 'my' ? '?t=' + Date.now() : '');
    $('#consolePetImg').src = previewImg.src;
    $('#previewTag').textContent = `${$('#petName').value.trim() || '灯灯'} 在陪你`;
    $('#petSpecies').value = species;
    $$('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.species === species));
    $$('.gallery-card').forEach(c => c.classList.toggle('is-active', c.dataset.species === species));
    $$('.action-btn').forEach(b => b.classList.toggle('is-active', b.dataset.action === action));
  }

  function showBubble(text, ms = 2600) {
    bubble.textContent = text;
    bubble.classList.add('is-show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('is-show'), ms);
  }

  function hearts(n = 4) {
    const r = preview.getBoundingClientRect(), s = screen.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'heart-float';
      el.textContent = ['💗','💕','✨','❤️'][i % 4];
      el.style.left = (r.left - s.left + r.width / 2 + (Math.random() - .5) * 70) + 'px';
      el.style.top = (r.top - s.top + 40 + Math.random() * 24) + 'px';
      el.style.animationDelay = (i * .1) + 's';
      screen.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }
  }

  function stopWalk() {
    if (walkAnim) { walkAnim.cancel(); walkAnim = null; }
    preview.style.animation = '';
    preview.classList.remove('is-dragging');
  }

  function localAction(action) {
    state.action = action;
    updatePreview(state.species, action);
    if (walkAnim) stopWalk();
    if (action === 'walk') {
      preview.classList.add('is-dragging');
      preview.style.animation = 'none';
      walkAnim = preview.animate([
        { transform:'translateX(-60px) translateY(0)' },
        { transform:'translateX(0) translateY(-5px)' },
        { transform:'translateX(60px) translateY(0)' },
        { transform:'translateX(0) translateY(-5px)' },
        { transform:'translateX(-60px) translateY(0)' },
      ], { duration:5200, iterations:Infinity, easing:'ease-in-out' });
      showBubble('出去溜达一圈～');
    } else if (action === 'stretch') {
      previewImg.style.transition = 'transform .5s';
      previewImg.style.transform = 'scaleX(1.14) scaleY(.9)';
      showBubble('啊——伸个懒腰');
      setTimeout(() => { previewImg.style.transform = ''; }, 1900);
    } else if (action === 'sleep') {
      showBubble('Zzz… 我睡一会儿');
    } else if (action === 'groom') {
      showBubble('舔舔毛，整理一下');
    } else if (action === 'happy' || action === 'feed') {
      hearts(5);
      showBubble(action === 'feed' ? '好吃！谢谢你～' : '嘿嘿，最喜欢你了！');
    } else if (action === 'idle') {
      showBubble('在呢，一直都在。');
    }
  }

  // drag the preview pet
  let drag = null;
  preview.addEventListener('pointerdown', (e) => {
    const pr = preview.getBoundingClientRect(), sr = screen.getBoundingClientRect();
    drag = { dx:e.clientX - pr.left, dy:e.clientY - pr.top, moved:false, startX:e.clientX, startY:e.clientY };
    preview.setPointerCapture(e.pointerId);
    stopWalk();
    preview.classList.add('is-dragging');
    // Freeze the current visual position as inline px so the first move doesn't jump.
    preview.style.left = (pr.left - sr.left) + 'px';
    preview.style.top = (pr.top - sr.top) + 'px';
    preview.style.bottom = 'auto';
    preview.style.transform = 'none';
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const sr = screen.getBoundingClientRect();
    const x = Math.max(0, Math.min(sr.width - preview.offsetWidth, e.clientX - sr.left - drag.dx));
    const y = Math.max(0, Math.min(sr.height - preview.offsetHeight - 30, e.clientY - sr.top - drag.dy));
    preview.style.left = x + 'px';
    preview.style.top = y + 'px';
    preview.style.transform = 'none';
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > 5) drag.moved = true;
  });
  preview.addEventListener('pointerup', () => {
    if (drag && !drag.moved) {
      hearts(4);
      showBubble(LINES[Math.floor(Math.random() * LINES.length)]);
      sendCommand('happy').catch(() => {});
    } else if (drag) {
      showBubble('我就站这儿陪你～');
    }
    drag = null;
    preview.classList.remove('is-dragging');
  });
  preview.addEventListener('dblclick', () => {
    preview.removeAttribute('style');
    stopWalk();
    showBubble('回到原位啦');
  });

  /* ---------------- console ---------------- */
  const consoleEl = $('#console'), overlay = $('#consoleOverlay');
  function openConsole() {
    overlay.hidden = false; consoleEl.hidden = false;
    requestAnimationFrame(() => { overlay.classList.add('is-open'); consoleEl.classList.add('is-open'); });
    poll();
  }
  function closeConsole() {
    overlay.classList.remove('is-open'); consoleEl.classList.remove('is-open');
    setTimeout(() => { overlay.hidden = true; consoleEl.hidden = true; }, 380);
  }
  $('#openConsole').addEventListener('click', openConsole);
  $$('[data-open-console]').forEach(b => b.addEventListener('click', openConsole));
  $('#closeConsole').addEventListener('click', closeConsole);
  overlay.addEventListener('click', closeConsole);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && consoleEl.classList.contains('is-open')) closeConsole(); });

  /* ---------------- remote calls ---------------- */
  function sendCommand(action, message = '') {
    localAction(action);
    return api('/api/command', { type:'action', action, message });
  }
  function sendConfig(patch) {
    clearTimeout(configTimer);
    configTimer = setTimeout(() => api('/api/config', patch).catch(() => {}), 260);
  }
  function collectConfig() {
    return {
      name: $('#petName').value.trim() || '灯灯',
      species: $('#petSpecies').value,
      size: +$('#petSize').value,
      speed: +$('#petSpeed').value,
      opacity: +$('#petOpacity').value,
      auto: $('#petAuto').checked,
      topmost: $('#petTopmost').checked,
    };
  }

  async function poll() {
    try {
      const data = await api('/api/state');
      state.online = true;
      state.running = data.running;
      state.config = data.config;
      const row = $('#statusRow'), link = $('#linkStatus');
      row.classList.toggle('is-on', data.running);
      link.classList.toggle('is-on', true);
      link.querySelector('span').textContent = data.running ? '桌宠已连接' : '服务已连接';
      $('#statusText').textContent = data.running ? '桌宠正在桌面陪你' : '服务在线，桌宠还没启动';
      $('#offlineTip').hidden = true;
      $('#launchBtn').textContent = data.running ? '重启' : '启动';
      if (!syncGuard && consoleEl.classList.contains('is-open')) syncUI(data.config);
    } catch (e) {
      state.online = false; state.running = false;
      $('#linkStatus').classList.remove('is-on');
      $('#linkStatus span').textContent = '未连接';
      $('#statusRow').classList.remove('is-on');
      $('#statusText').textContent = '本地服务未启动';
      $('#offlineTip').hidden = false;
    }
  }

  function syncUI(cfg) {
    if (!cfg) return;
    syncGuard = true;
    const set = (id, v) => { const el = $(id); if (el && document.activeElement !== el) el.value = v; };
    set('#petName', cfg.name || '灯灯');
    set('#petSpecies', cfg.species || 'cat');
    set('#petSize', cfg.size || 220);
    set('#petSpeed', cfg.speed || 2);
    set('#petOpacity', cfg.opacity || 1);
    $('#petAuto').checked = !!cfg.auto;
    $('#petTopmost').checked = !!cfg.topmost;
    $('#petSpecies').value = cfg.species || 'cat';
    $('#sizeValue').textContent = cfg.size || 220;
    $('#speedValue').textContent = cfg.speed || 2;
    $('#opacityValue').textContent = Math.round((cfg.opacity || 1) * 100) + '%';
    state.species = cfg.species || 'cat';
    updatePreview(state.species, state.action);
    $('#toggleVisible').textContent = cfg.visible === false ? '叫它回来' : '暂时藏起来';
    syncGuard = false;
  }

  // form controls -> live config
  ['#petName','#petSpecies','#petSize','#petSpeed','#petOpacity','#petAuto','#petTopmost'].forEach(id => {
    $(id).addEventListener('input', () => {
      $('#sizeValue').textContent = $('#petSize').value;
      $('#speedValue').textContent = $('#petSpeed').value;
      $('#opacityValue').textContent = Math.round(+$('#petOpacity').value * 100) + '%';
      const sp = $('#petSpecies').value;
      if (sp !== state.species) { state.species = sp; updatePreview(sp, 'idle'); }
      $('#previewTag').textContent = `${$('#petName').value.trim() || '灯灯'} 在陪你`;
      sendConfig(collectConfig());
    });
  });

  $$('.action-btn').forEach(btn => btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    sendCommand(action, action === 'hello' ? '汪！我在～' : '').catch(() => toast('命令没送出去，先启动本地服务'));
    if (state.running) toast(`已让 ${$('#petName').value.trim() || '灯灯'} 去${btn.textContent.trim().split(/\s+/).pop()}`);
  }));

  $('#sayBtn').addEventListener('click', () => {
    const text = $('#sayText').value.trim();
    if (!text) { toast('先写点什么给它吧'); return; }
    showBubble(text, 3200);
    api('/api/command', { type:'action', action:'idle', message:text })
      .then(() => toast('它听见了')).catch(() => toast('服务未启动，网页预览已显示'));
    $('#sayText').value = '';
  });
  $('#sayText').addEventListener('keydown', e => { if (e.key === 'Enter') $('#sayBtn').click(); });

  // species chips, gallery cards, pose cards
  $$('.chip, .gallery-card').forEach(el => el.addEventListener('click', () => {
    const sp = el.dataset.species;
    state.species = sp;
    $('#petSpecies').value = sp;
    updatePreview(sp, 'idle');
    sendConfig(collectConfig());
    sendCommand('happy').catch(() => {});
    toast(`已换成 ${el.dataset.name || SPECIES_LABEL[sp]}，桌面上的它也换好啦`);
  }));
  $$('.pose').forEach(el => el.addEventListener('click', () => {
    sendCommand(el.dataset.action).catch(() => {});
    toast('动作已同步到桌面宠物');
  }));

  // upload own pet photo
  $('#photoInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 900, scale = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        state.uploaded = cv.toDataURL('image/png');
        $('#photoPreviewImg').src = state.uploaded;
        $('#photoPreview').hidden = false;
        $('#applyPhoto').disabled = false;
        toast('照片好了，点「应用到桌面」');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  $('#applyPhoto').addEventListener('click', async () => {
    if (!state.uploaded) return;
    $('#applyPhoto').disabled = true;
    try {
      await api('/api/upload', { image:state.uploaded, smart_matte:$('#keepBg').checked });
      state.species = 'my';
      $('#petSpecies').value = 'my';
      updatePreview('my', 'happy');
      hearts(6);
      toast('好啦！你家那只已经上桌了 🐾');
    } catch (err) {
      toast('上传失败：' + err.message);
    } finally { $('#applyPhoto').disabled = false; }
  });

  // power buttons
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  async function launch(force = false) {
    try {
      if (force && state.running) {
        await api('/api/quit', {});
        toast('它先歇一下，马上回来…');
        await wait(1800);
      }
      const r = await api('/api/launch', {});
      toast(r.ok ? '正在把它放到桌面…' : '启动失败，请检查 start.bat');
      setTimeout(poll, 1200);
    } catch { toast('本地服务未启动，请双击 start.bat'); }
  }
  $('#launchBtn').addEventListener('click', () => launch(state.running));
  $('#footerLaunch').addEventListener('click', () => launch());
  $('#importDesktop').addEventListener('click', () => { launch(); openConsole(); });
  $('#quitPet').addEventListener('click', async () => {
    try { await api('/api/quit', {}); toast('它去睡了，随时可以再叫醒'); setTimeout(poll, 600); }
    catch { toast('本地服务未启动'); }
  });
  $('#footerQuit').addEventListener('click', () => $('#quitPet').click());
  $('#restartPet').addEventListener('click', () => launch(true));
  $('#toggleVisible').addEventListener('click', async () => {
    const hidden = state.config && state.config.visible === false;
    try {
      await api('/api/config', { visible:hidden ? true : false });
      $('#toggleVisible').textContent = hidden ? '暂时藏起来' : '叫它回来';
      toast(hidden ? '它回来啦 🐾' : '先藏一会儿，再点一次就能叫回来');
      setTimeout(poll, 500);
    } catch { toast('本地服务未启动'); }
  });

  // clock + boot
  const clock = () => {
    const d = new Date();
    $('#tbTime').textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  };
  clock(); setInterval(clock, 30000);
  updatePreview('cat', 'idle');
  poll();
  setInterval(poll, 2500);
  // ?console=1 opens the remote control directly (handy as a desktop shortcut)
  if (new URLSearchParams(location.search).get('console') === '1') openConsole();
})();
