/**
 * Programmatic promo stills with accurate South Korea geometry (app-matched).
 * Run: node scripts/render-promo-stills.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets/promo');

const BG = '#F7F1E8';
const PAPER = '#FFFBF5';
const INK = '#2C3E50';
const MARK_COLOR = '#33475B';

async function textPng(text, width, fontSize) {
  const sharp = (await import('sharp')).default;
  return sharp({
    text: {
      text,
      width,
      fontfile: '/System/Library/Fonts/AppleSDGothicNeo.ttc',
      fontsize: fontSize,
      rgba: true,
      align: 'center',
    },
  })
    .png()
    .toBuffer();
}

async function tintedMark(sharp, height, opacity = 1) {
  const markPath = path.join(OUT, '_ref-south-korea-mark.png');
  let img = sharp(markPath).resize({ height }).ensureAlpha();
  if (opacity < 1) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round(data[i] * opacity);
    }
    img = sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    });
  }
  return img.png().toBuffer();
}

async function renderPaperMap() {
  const sharp = (await import('sharp')).default;
  const W = 1080;
  const H = 1440;

  const bg = await sharp({
    create: { width: W, height: H, channels: 3, background: BG },
  })
    .png()
    .toBuffer();

  const paperW = Math.round(W * 0.78);
  const paperH = Math.round(H * 0.48);
  const paperX = Math.round((W - paperW) / 2);
  const paperY = Math.round(H * 0.1);

  const paper = await sharp({
    create: {
      width: paperW,
      height: paperH,
      channels: 4,
      background: { r: 255, g: 251, b: 245, alpha: 255 },
    },
  })
    .png()
    .toBuffer();

  const mapPath = path.join(OUT, '_ref-south-korea-map.png');
  const mapW = Math.round(paperW * 0.88);
  const mapH = Math.round(paperH * 0.82);
  const map = await sharp(mapPath)
    .resize({ width: mapW, height: mapH, fit: 'contain', background: '#CBE0EF' })
    .png()
    .toBuffer();
  const mapMeta = await sharp(map).metadata();

  const mark = await tintedMark(sharp, Math.round(H * 0.045));
  const title = await textPng('한달음', 900, 96);
  const line1 = await textPng('이번 달, 발자국만 모아도', 960, 40);
  const line2 = await textPng('한 장이 된다', 960, 40);

  const mapLeft = paperX + Math.round((paperW - (mapMeta.width ?? mapW)) / 2);
  const mapTop = paperY + Math.round((paperH - (mapMeta.height ?? mapH)) / 2);

  await sharp(bg)
    .composite([
      { input: paper, left: paperX, top: paperY },
      { input: map, left: mapLeft, top: mapTop },
      { input: mark, left: paperX + 28, top: paperY + 24 },
      { input: title, left: Math.round((W - 900) / 2), top: Math.round(H * 0.66) },
      { input: line1, left: Math.round((W - 960) / 2), top: Math.round(H * 0.74) },
      { input: line2, left: Math.round((W - 960) / 2), top: Math.round(H * 0.78) },
    ])
    .png()
    .toFile(path.join(OUT, 'ig-b-paper-map.png'));

  console.log('Wrote ig-b-paper-map.png');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(path.join(OUT, '_ref-south-korea-map.png'))) {
    console.error('Run node scripts/render-promo-refs.mjs first');
    process.exit(1);
  }
  await renderPaperMap();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
