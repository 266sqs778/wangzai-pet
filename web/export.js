/* Assembles the downloadable desktop-pet package. Kept separate from the UI
   so it can be exercised by selftest.html.

   Two modes:
   - lite: BAT + PowerShell runtime, sprites colour-keyed to magenta.
   - exe:  the generic wangzai-pet.exe, sprites kept as transparent RGBA.
           TheEXE reads pet-config.json and assets/pet/*.png from its own
           folder, so one binary becomes a personally customised desktop pet.
   Nothing is uploaded: the engine is either embedded in this page or fetched
   once as a static file, then written into the ZIP in the browser. */
(function (global) {
  'use strict';

  const EXE_README = [
    '望崽宠乐园 · 你的专属桌宠',
    '',
    '【怎么用】',
    '1. 把整个文件夹解压到任意位置（不要只把 exe 单独拖出来）。',
    '2. 双击 wangzai-pet.exe，桌宠就出现在桌面右上角。',
    '3. 拖动它换位置，点一下摸摸，右键可以换动作、说话、退出。',
    '',
    '【它认识你家的那只】',
    'assets/pet/ 里的 PNG 就是从你上传的照片生成的动作帧。',
    'pet-config.json 存着名字、台词、大小和手感，用记事本就能改。',
    '',
    '【放心用】',
    '完全离线、免安装、不需要 Python。照片没有上传到任何服务器。',
    '把这个文件夹压缩发给朋友，对方解压双击也能看到同一只宠物。',
    '',
    '望崽宠乐园 · 万界店长 · 模因公社',
  ].join('\r\n');

  let engineCache = null;
  let enginePromise = null;

  function base64ToBytes(b64) {
    const bin = global.atob(b64.replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* Prefer the binary embedded by build_standalone.py: that keeps the
     single-file edition fully offline. Multi-file / Pages builds fall back
     to one static fetch of the engine. */
  function getEngine(onProgress) {
    if (engineCache) return Promise.resolve(engineCache);
    if (enginePromise) return enginePromise;
    enginePromise = (async () => {
      const embedded = document.getElementById('petEngineB64');
      if (embedded && embedded.textContent && embedded.textContent.length > 10000) {
        if (onProgress) onProgress(0.42, '正在解包桌宠引擎…');
        await new Promise((r) => setTimeout(r, 0)); // let the progress paint
        engineCache = base64ToBytes(embedded.textContent);
        if (onProgress) onProgress(0.62, '引擎就绪');
        return engineCache;
      }
      const resp = await global.fetch('download/wangzai-pet.exe', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('桌宠引擎下载失败（HTTP ' + resp.status + '）');
      const total = Number(resp.headers.get('content-length')) || 0;
      if (resp.body && resp.body.getReader && total) {
        const reader = resp.body.getReader();
        const chunks = [];
        let got = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          chunks.push(part.value);
          got += part.value.length;
          if (onProgress) {
            onProgress(0.10 + 0.52 * (got / total),
              '正在下载桌宠引擎 ' + Math.round(got / total * 100) + '%');
          }
        }
        const all = new Uint8Array(got);
        let off = 0;
        for (const c of chunks) { all.set(c, off); off += c.length; }
        engineCache = all;
      } else {
        engineCache = new Uint8Array(await resp.arrayBuffer());
      }
      if (onProgress) onProgress(0.62, '引擎就绪');
      return engineCache;
    })().catch((e) => { enginePromise = null; throw e; });
    return enginePromise;
  }

  /* Exact expression kept intact: build_standalone.py rewrites it to __A(). */
  function loadSprite(n, opts) {
    return global.PET_PACK.loadImage((opts.assetBase || 'assets/pet/') + n + '.png');
  }

  /* canvasPngBytes() needs a canvas. derivePoses() already returns canvases;
     sprites loaded from disk are <img> elements and must be rasterised first.
     Without this the EXE mode silently drops every built-in sprite. */
  function asCanvas(source) {
    if (source && typeof source.toBlob === 'function') return source;
    const cv = document.createElement('canvas');
    cv.width = source.naturalWidth || source.width;
    cv.height = source.naturalHeight || source.height;
    cv.getContext('2d').drawImage(source, 0, 0);
    return cv;
  }

  async function buildPackage(opts) {
    const cfg = opts.cfg || {};
    const names = Array.from(new Set(opts.spriteNames || []));
    const customCanvas = opts.customCanvas || null;
    const withExe = !!opts.withExe;
    const onProgress = opts.onProgress || function () {};
    const files = [];
    const used = new Set();
    const addSprite = async (name, source) => {
      if (used.has(name) || !source) return;
      used.add(name);
      // WinForms needs a magenta colour key; the Python EXE uses real alpha.
      const cv = withExe ? asCanvas(source) : global.PET_PACK.magentaKey(source, 320);
      files.push({ name: 'assets/pet/' + name + '.png', data: await global.PET_PACK.canvasPngBytes(cv) });
    };

    if (withExe) {
      const engine = await getEngine(onProgress);
      files.push({ name: 'wangzai-pet.exe', data: engine });
      files.push({ name: 'README.txt', data: EXE_README });
    } else {
      files.push({ name: 'win_pet.ps1', data: global.PET_RUNTIME.winPetPs1 });
      files.push({ name: 'start.bat', data: global.PET_RUNTIME.startBat });
      files.push({ name: 'README.txt', data: global.PET_RUNTIME.readme });
    }

    onProgress(0.68, '正在生成动作帧…');

    /* A visitor's photo gets real multi-frame loops. Reuse the frames the
       live preview already rendered when available; otherwise derive them
       here. The EXE engine reads `animations` from pet-config.json and plays
       them back at the configured fps. The lite BAT runtime only handles a
       single frame per action, so it keeps the compact four-pose set. */
    if (customCanvas) {
      const built = withExe
        ? (opts.customFrames && opts.animations
            ? { frames: opts.customFrames, animations: opts.animations }
            : global.PET_PACK.buildAnimationFrames(customCanvas))
        : { frames: global.PET_PACK.derivePoses(customCanvas), animations: null };
      if (withExe && built.animations) cfg.animations = built.animations;
      for (const name of Object.keys(built.frames)) await addSprite(name, built.frames[name]);
    } else {
      for (const n of names) {
        try { await addSprite(n, await loadSprite(n, opts)); }
        catch (_) { /* a missing pose is simply skipped */ }
      }
    }

    if (withExe) {
      // desktop_pet.py falls back to cat_idle and draws a heart for "摸摸".
      for (const n of ['heart', 'cat_idle']) {
        if (used.has(n)) continue;
        try { await addSprite(n, await loadSprite(n, opts)); }
        catch (_) { /* optional decoration */ }
      }
    }
    if (!used.size) throw new Error('没有可用的素材');

    // Serialise last so the animation map is included when present.
    files.unshift({ name: 'pet-config.json', data: JSON.stringify(cfg, null, 2) });
    onProgress(0.9, '正在打包…');
    const blob = global.PET_PACK.buildZip(files);
    return { blob, count: used.size, fileNames: files.map((f) => f.name), withExe };
  }

  global.PET_EXPORT = { buildPackage, getEngine };
})(window);
