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

  /* Soft circular sticker for a visitor's own photo (feathered alpha edge). */
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

    const cv = document.createElement('canvas');
    cv.width = s; cv.height = s;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, s, s);
    ctx.drawImage(tmp, 0, 0);
    return cv;
  }

  function canvasPngBytes(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('PNG encode failed'));
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
      }, 'image/png');
    });
  }

  /* Derive extra poses from a visitor's own photo so "my pet" animates. */
  function derivePoses(canvas) {
    const w = canvas.width, h = canvas.height;
    const pose = (fn) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.translate(w / 2, h / 2);
      fn(ctx);
      ctx.translate(-w / 2, -h / 2);
      ctx.drawImage(canvas, 0, 0);
      return cv;
    };
    const stretched = document.createElement('canvas');
    stretched.width = w; stretched.height = h;
    stretched.getContext('2d').drawImage(canvas, 0, h - Math.round(h * 1.16), w, Math.round(h * 1.16));
    return {
      'my-pet': canvas,
      'my-pet-walk': pose((c) => { c.rotate(4 * Math.PI / 180); c.scale(0.98, 0.98); }),
      'my-pet-stretch': stretched,
      'my-pet-groom': pose((c) => c.rotate(11 * Math.PI / 180)),
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

  global.PET_PACK = { buildZip, magentaKey, sticker, canvasPngBytes, derivePoses, loadImage };
})(window);
