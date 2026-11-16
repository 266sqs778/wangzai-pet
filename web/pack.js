/* Minimal ZIP writer (store method, no dependency). Package is assembled
   entirely in the browser: nothing is uploaded, nothing leaves the machine. */
(function (global) {
  'use strict';

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();
  const toBytes = (v) => typeof v === 'string' ? enc.encode(v) : v;

  function dosStamp(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time: time & 0xFFFF, date: date & 0xFFFF };
  }

  function buildZip(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const stamp = dosStamp(new Date());

    files.forEach((file) => {
      const nameBytes = enc.encode(file.name);
      const data = toBytes(file.data);
      const crc = crc32(data);

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034B50, true);
      lv.setUint16(4, 20, true);
      lv.setUint16(6, 0x0800, true);           // UTF-8 filename flag
      lv.setUint16(8, 0, true);                // stored
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);
      chunks.push(local, data);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014B50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + data.length;
    });

    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054B50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob([...chunks, ...central, eocd], { type: 'application/zip' });
  }

  /* Convert a transparent sprite into an opaque magenta-keyed PNG.
     Windows Forms uses TransparencyKey to punch out #FF00FF exactly, so we
     binarise the alpha instead of letting semi-transparent fur turn pink. */
  function magentaKey(imageOrCanvas, maxSide) {
    const src = imageOrCanvas;
    const scale = Math.min(1, (maxSide || 320) / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(src, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) {
        d[i] = 255; d[i + 1] = 0; d[i + 2] = 255; d[i + 3] = 255;
      } else {
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* Soft circular sticker for a visitor's own photo (feathered alpha edge).
     Keeps real transparency: preview and the EXE need alpha, while the lite
     BAT runtime converts it to a magenta colour key at export time. */
  function sticker(image, side) {
    const s = side || 320;
    const tmp = document.createElement('canvas');
    tmp.width = s; tmp.height = s;
    const t = tmp.getContext('2d');
    const crop = Math.min(image.width, image.height);
    t.drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2,
                crop, crop, 0, 0, s, s);
    const g = t.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.84, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    t.globalCompositeOperation = 'destination-in';
    t.fillStyle = g;
    t.fillRect(0, 0, s, s);
    t.globalCompositeOperation = 'source-over';
    return tmp;
  }

  /* ---------- make a uploaded photo look like a standalone pet ----------
     A plain circular crop keeps the photo's original background, which reads
     as a "photo sticker" rather than a pet sitting on your desktop. Try a
     conservative border-seed flood fill first: it only fires when the image
     edge is a fairly uniform colour (studio / wall shots). Anything noisier
     falls back to the feathered circle, so we never chew up a good photo. */
  function removeBorderBackground(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const band = Math.max(3, Math.round(Math.min(w, h) * 0.05));
    const step = 3;
    const rs = [], gs = [], bs = [];
    const sample = (x, y) => { const i = (y * w + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); };
    for (let y = 0; y < band; y++) for (let x = 0; x < w; x += step) {
      sample(x, y); sample(x, h - 1 - y);
    }
    for (let x = 0; x < band; x++) for (let y = 0; y < h; y += step) {
      sample(x, y); sample(w - 1 - x, y);
    }
    const med = (a) => { a.sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
    const br = med(rs), bg = med(gs), bb = med(bs);
    let dev = 0;
    for (let i = 0; i < rs.length; i++) {
      dev += Math.abs(rs[i] - br) + Math.abs(gs[i] - bg) + Math.abs(bs[i] - bb);
    }
    dev /= rs.length * 3;
    if (dev > 34) return false; // busy background: don't guess

    const tol = Math.max(40, Math.round(dev * 2.4));
    const dist = (i) => Math.max(Math.abs(d[i] - br), Math.abs(d[i + 1] - bg), Math.abs(d[i + 2] - bb));
    const seen = new Uint8Array(w * h);
    const gone = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0, tail = 0;
    const push = (x, y) => {
      const p = y * w + x;
      if (seen[p]) return;
      seen[p] = 1;
      if (dist(p * 4) <= tol) { queue[tail++] = p; }
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    let removed = 0;
    while (head < tail) {
      const p = queue[head++];
      const x = p % w, y = (p / w) | 0;
      d[p * 4 + 3] = 0; gone[p] = 1; removed++;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    const frac = removed / (w * h);
    if (frac < 0.03 || frac > 0.82) return false; // nothing removed / ate the pet
    // soften the cut boundary so it doesn't look scissor-cut
    for (let p = 0; p < w * h; p++) {
      if (gone[p] || d[p * 4 + 3] === 0) continue;
      const x = p % w, y = (p / w) | 0;
      let nextToCut = false;
      if (x > 0 && gone[p - 1]) nextToCut = true;
      else if (x < w - 1 && gone[p + 1]) nextToCut = true;
      else if (y > 0 && gone[p - w]) nextToCut = true;
      else if (y < h - 1 && gone[p + w]) nextToCut = true;
      if (!nextToCut) continue;
      const dv = dist(p * 4);
      if (dv < tol * 1.35) {
        d[p * 4 + 3] = Math.round(255 * Math.min(1, (dv - tol) / (tol * 0.35)));
      }
    }
    ctx.putImageData(img, 0, 0);
    return true;
  }

  function trimToContent(canvas, pad) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 <= x0 || y1 <= y0) return canvas;
    const p = pad == null ? 0.06 : pad;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const c = out.getContext('2d');
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const scale = Math.min(w * (1 - 2 * p) / cw, h * (1 - 2 * p) / ch);
    const nw = cw * scale, nh = ch * scale;
    c.drawImage(canvas, x0, y0, cw, ch, (w - nw) / 2, (h - nh) / 2, nw, nh);
    return out;
  }

  /* Returns { canvas, backgroundRemoved }. The canvas is always transparent. */
  function preparePet(image, side, removeBg) {
    const s = side || 360;
    const tmp = document.createElement('canvas');
    tmp.width = s; tmp.height = s;
    const t = tmp.getContext('2d');
    const crop = Math.min(image.width, image.height);
    t.drawImage(image, (image.width - crop) / 2, (image.height - crop) / 2,
                crop, crop, 0, 0, s, s);
    if (removeBg !== false && removeBorderBackground(tmp)) {
      return { canvas: trimToContent(tmp, 0.08), backgroundRemoved: true };
    }
    return { canvas: sticker(image, s), backgroundRemoved: false };
  }

  function canvasPngBytes(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('PNG encode failed'));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
      }, 'image/png');
    });
  }

  /* ---------- real frame-by-frame animation for the visitor's own pet ----------
     v1.5.0: the old derivePoses() produced ONE slightly rotated copy per
     action, so the exported pet looked like a frozen sticker. We now render
     full loops for six behaviours. The desktop engine reads the returned
     `animations` map from pet-config.json and plays the frames at `fps`.
     Transparent RGBA in, transparent RGBA out; magenta-keying (lite BAT
     export) still happens later in export.js. */
  function drawPose(src, opts) {
    const cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const c = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    c.translate(w / 2 + (opts.dx || 0), h / 2 + (opts.dy || 0));
    if (opts.rot) c.rotate(opts.rot * Math.PI / 180);
    c.scale(opts.sx == null ? 1 : opts.sx, opts.sy == null ? 1 : opts.sy);
    c.translate(-w / 2, -h / 2);
    c.drawImage(src, 0, 0);
    return cv;
  }

  const loopFrames = (n, fn) => Array.from({ length: n }, (_, i) => fn(i, n));

  function buildAnimationFrames(src) {
    const w = src.width, h = src.height;
    const defs = {
      // slow breathing, with one soft "blink" compression on frame 4
      idle: { fps: 3, frames: loopFrames(6, (i) => {
        const t = i / 6 * Math.PI * 2;
        const blink = i === 4 ? 0.955 : 1;
        return drawPose(src, {
          sx: 1 + 0.026 * Math.sin(t) + (i === 4 ? 0.008 : 0),
          sy: (1 + 0.028 * Math.sin(t)) * blink,
          dy: 1.5 * Math.sin(t),
        });
      }) },
      // alternating lean + bounce; the engine walks the window at the same time
      walk: { fps: 7, frames: loopFrames(8, (i) => {
        const t = i / 8 * Math.PI * 2;
        return drawPose(src, {
          rot: 5 * Math.sin(t), dy: -2.6 * Math.abs(Math.sin(t)),
          sx: 1 + 0.012 * Math.cos(t), sy: 1 - 0.008 * Math.abs(Math.sin(t)),
        });
      }) },
      // bottom-anchored stretch and relaxed return
      stretch: { fps: 5, frames: loopFrames(6, (i) => {
        const p = i / 5, k = Math.sin(p * Math.PI);
        const sy = 1 + 0.18 * k, sx = 1 - 0.06 * k;
        return drawPose(src, { sx, sy, dy: -(sy - 1) * h / 2 });
      }) },
      // head tilt / lick / back to centre
      groom: { fps: 5, frames: loopFrames(6, (i) => {
        const p = i / 5, k = Math.sin(p * Math.PI);
        return drawPose(src, { rot: 12 * k, sy: 1 - 0.03 * k, dy: 2 * k });
      }) },
      // very slow breathing for the sleeping state (engine draws the Zzz)
      sleep: { fps: 2, frames: loopFrames(6, (i) => {
        const t = i / 6 * Math.PI * 2;
        return drawPose(src, { sy: 1 + 0.022 * Math.sin(t), sx: 1 - 0.01 * Math.sin(t), dy: 1.2 * Math.sin(t) });
      }) },
      // two joyful hops per loop with a wiggle; engine adds floating hearts
      happy: { fps: 8, frames: loopFrames(8, (i) => {
        const p = i / 8, hop = Math.abs(Math.sin(p * 2 * Math.PI));
        const s = 1 + 0.06 * hop;
        return drawPose(src, { rot: 7 * Math.sin(p * 2 * Math.PI), sx: s, sy: s, dy: -10 * hop });
      }) },
    };

    const frames = {}, animations = {};
    Object.keys(defs).forEach((act) => {
      const def = defs[act];
      const names = def.frames.map((_, i) => 'my-pet-' + act + '-' + i);
      names.forEach((n, i) => { frames[n] = def.frames[i]; });
      animations[act] = { frames: names, fps: def.fps, loop: true };
    });
    // Legacy single-frame names keep older engines and the lite runtime happy.
    frames['my-pet'] = defs.idle.frames[0];
    ['walk', 'stretch', 'groom'].forEach((a) => { frames['my-pet-' + a] = defs[a].frames[0]; });
    return { frames, animations, count: Object.keys(frames).length };
  }

  /* Kept for the lite runtime and older callers. */
  function derivePoses(canvas) {
    const anim = buildAnimationFrames(canvas);
    return {
      'my-pet': anim.frames['my-pet'],
      'my-pet-walk': anim.frames['my-pet-walk'],
      'my-pet-stretch': anim.frames['my-pet-stretch'],
      'my-pet-groom': anim.frames['my-pet-groom'],
    };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('image load failed: ' + src));
      im.src = src;
    });
  }

  global.PET_PACK = { buildZip, magentaKey, sticker, preparePet, canvasPngBytes, derivePoses, buildAnimationFrames, loadImage };
})(window);
