/* Assembles the downloadable, dependency-free desktop-pet package.
   Kept separate from the UI so it can be exercised by selftest.html. */
(function (global) {
  'use strict';

  async function buildPackage(opts) {
    const cfg = opts.cfg || {};
    const names = Array.from(new Set(opts.spriteNames || []));
    const customCanvas = opts.customCanvas || null;
    const files = [
      { name: 'pet-config.json', data: JSON.stringify(cfg, null, 2) },
      { name: 'win_pet.ps1', data: global.PET_RUNTIME.winPetPs1 },
      { name: 'start.bat', data: global.PET_RUNTIME.startBat },
      { name: 'README.txt', data: global.PET_RUNTIME.readme },
    ];

    let count = 0;
    if (customCanvas) {
      const poses = global.PET_PACK.derivePoses(customCanvas);
      for (const [name, source] of Object.entries(poses)) {
        const cv = global.PET_PACK.magentaKey(source, 320);
        files.push({ name: 'assets/pet/' + name + '.png', data: await global.PET_PACK.canvasPngBytes(cv) });
        count++;
      }
    } else {
      for (const n of names) {
        try {
          const im = await global.PET_PACK.loadImage((opts.assetBase || 'assets/pet/') + n + '.png');
          const cv = global.PET_PACK.magentaKey(im, 320);
          files.push({ name: 'assets/pet/' + n + '.png', data: await global.PET_PACK.canvasPngBytes(cv) });
          count++;
        } catch (_) { /* a missing pose is simply skipped */ }
      }
    }
    if (!count) throw new Error('没有可用的素材');
    const blob = global.PET_PACK.buildZip(files);
    return { blob, count, fileNames: files.map((f) => f.name) };
  }

  global.PET_EXPORT = { buildPackage };
})(window);
