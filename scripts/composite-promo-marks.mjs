/**
 * Overlay accurate South Korea brand marks onto promo stills.
 * Uses app brandMark silhouette — Republic of Korea only (mainland + Jeju).
 *
 *   node scripts/render-promo-refs.mjs
 *   node scripts/composite-promo-marks.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PROMO = path.join(ROOT, 'assets/promo');
const SRC = path.join(
  process.env.PROMO_SRC ??
    '/Users/mungyubin/.cursor/projects/Users-mungyubin-Desktop-Coding-handaleum/assets',
);

const MARK = path.join(PROMO, '_ref-south-korea-mark.png');

async function overlayMark(sharp, basePath, outPath, box) {
  const base = sharp(basePath);
  const meta = await base.metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;

  const markH = Math.round(h * box.hRatio);
  const mark = await sharp(MARK).resize({ height: markH }).png().toBuffer();
  const markMeta = await sharp(mark).metadata();
  const markW = markMeta.width ?? markH;

  let left = Math.round(w * box.xRatio - markW / 2);
  let top = Math.round(h * box.yRatio);
  left = Math.max(0, Math.min(left, w - markW));

  const layers = [{ input: mark, left, top, blend: 'over' }];

  if (box.faint) {
    const faintH = Math.round(h * (box.faintHRatio ?? 0.4));
    const faint = await sharp(MARK).resize({ height: faintH }).ensureAlpha().png().toBuffer();
    const faintMeta = await sharp(faint).metadata();
    const faintW = faintMeta.width ?? faintH;
    const faintLeft = Math.round((w - faintW) / 2);
    const faintTop = Math.round(h * (box.faintYRatio ?? 0.36));

    const { data, info } = await sharp(faint)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alpha = box.faintOpacity ?? 0.14;
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round(data[i] * alpha);
    }
    const faintLayer = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    layers.unshift({ input: faintLayer, left: faintLeft, top: faintTop, blend: 'over' });
  }

  await base.ensureAlpha().composite(layers).png().toFile(outPath);
  console.log('Wrote', outPath);
}

async function main() {
  const sharp = (await import('sharp')).default;
  fs.mkdirSync(PROMO, { recursive: true });

  await overlayMark(
    sharp,
    path.join(SRC, 'ig-a-recap-board.png'),
    path.join(PROMO, 'ig-a-recap-board.png'),
    { xRatio: 0.91, yRatio: 0.045, hRatio: 0.065 },
  );

  await overlayMark(
    sharp,
    path.join(SRC, 'ig-b-stamps-v2.png'),
    path.join(PROMO, 'ig-b-stamps.png'),
    {
      xRatio: 0.5,
      yRatio: 0.055,
      hRatio: 0.06,
      faint: true,
      faintHRatio: 0.46,
      faintYRatio: 0.355,
      faintOpacity: 0.28,
    },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
