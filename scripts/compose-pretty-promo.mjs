/**
 * Pretty promo stills using the app's South Korea map (not AI peninsula).
 * Prereq: node scripts/render-promo-refs.mjs
 * Inputs live in Cursor assets/; outputs in assets/promo/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PROMO = path.join(ROOT, 'assets/promo');
const GEN =
  '/Users/mungyubin/.cursor/projects/Users-mungyubin-Desktop-Coding-handaleum/assets';

const FOCUS = {
  minLng: 125.75,
  maxLng: 129.6,
  minLat: 33.08,
  maxLat: 38.62,
};

const PINS = [
  { name: '서울', lng: 126.978, lat: 37.5665, file: 'promo-polaroid-seoul.png' },
  { name: '부산', lng: 129.0756, lat: 35.1796, file: 'promo-polaroid-busan.png' },
  { name: '제주', lng: 126.5312, lat: 33.3617, file: 'promo-polaroid-jeju.png' },
];

function mercatorY(lat) {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function project(lng, lat, w, h, pad) {
  const x0 = (FOCUS.minLng * Math.PI) / 180;
  const x1 = (FOCUS.maxLng * Math.PI) / 180;
  const y0 = mercatorY(FOCUS.minLat);
  const y1 = mercatorY(FOCUS.maxLat);
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const scale = Math.min(innerW / (x1 - x0), innerH / (y1 - y0));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const x = pad + innerW / 2 + ((lng * Math.PI) / 180 - cx) * scale;
  const y = pad + innerH / 2 - (mercatorY(lat) - cy) * scale;
  return [x, y];
}

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

async function overlayMark(sharp, src, dest, box) {
  const base = sharp(src);
  const { width: w = 1, height: h = 1 } = await base.metadata();
  const markH = Math.round(h * box.hRatio);
  const mark = await sharp(path.join(PROMO, '_ref-south-korea-mark.png'))
    .resize({ height: markH })
    .png()
    .toBuffer();
  const { width: markW = markH } = await sharp(mark).metadata();
  const left = Math.max(0, Math.round(w * box.xRatio - markW / 2));
  const top = Math.round(h * box.yRatio);
  const coverW = Math.round(markW * 1.8);
  const coverH = Math.round(markH * 1.35);
  const cover = await sharp({
    create: {
      width: coverW,
      height: coverH,
      channels: 4,
      background: { r: 247, g: 241, b: 232, alpha: 255 },
    },
  })
    .png()
    .toBuffer();
  const layers = [
    {
      input: cover,
      left: Math.max(0, left - Math.round((coverW - markW) / 2)),
      top: Math.max(0, top - 8),
      blend: 'over',
    },
    { input: mark, left, top, blend: 'over' },
  ];

  if (box.faint) {
    const faintH = Math.round(h * box.faintHRatio);
    const washW = Math.round(w * 0.42);
    const washH = Math.round(h * 0.38);
    const wash = await sharp({
      create: {
        width: washW,
        height: washH,
        channels: 4,
        background: { r: 247, g: 241, b: 232, alpha: 230 },
      },
    })
      .png()
      .toBuffer();
    const faint = await sharp(path.join(PROMO, '_ref-south-korea-mark.png'))
      .resize({ height: faintH })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < faint.data.length; i += 4) {
      faint.data[i] = Math.round(faint.data[i] * box.faintOpacity);
    }
    const faintPng = await sharp(faint.data, {
      raw: { width: faint.info.width, height: faint.info.height, channels: 4 },
    })
      .png()
      .toBuffer();
    layers.unshift({
      input: wash,
      left: Math.round((w - washW) / 2),
      top: Math.round(h * (box.faintYRatio - 0.04)),
      blend: 'over',
    });
    layers.splice(1, 0, {
      input: faintPng,
      left: Math.round((w - faint.info.width) / 2),
      top: Math.round(h * box.faintYRatio),
      blend: 'over',
    });
  }

  await base.composite(layers).png().toFile(dest);
  console.log('Wrote', dest);
}

async function paperMap(sharp) {
  const desk = path.join(GEN, 'promo-desk-blank.png');
  const { width: W, height: H } = await sharp(desk).metadata();

  const paperX = Math.round(W * 0.16);
  const paperY = Math.round(H * 0.1);
  const paperW = Math.round(W * 0.68);
  const paperH = Math.round(H * 0.46);

  const mapBuf = await sharp(path.join(PROMO, '_ref-south-korea-map.png'))
    .resize({
      width: paperW,
      height: paperH,
      fit: 'contain',
      background: { r: 203, g: 224, b: 239, alpha: 1 },
    })
    .flatten({ background: '#CBE0EF' })
    .png()
    .toBuffer();
  const mapMeta = await sharp(mapBuf).metadata();
  const mapW = mapMeta.width ?? paperW;
  const mapH = mapMeta.height ?? paperH;
  const mapLeft = paperX + Math.round((paperW - mapW) / 2);
  const mapTop = paperY + Math.round((paperH - mapH) / 2);

  const polaroidSize = Math.round(W * 0.16);
  const layers = [
    { input: mapBuf, left: mapLeft, top: mapTop },
  ];

  const pinPts = [];
  for (const pin of PINS) {
    const [lx, ly] = project(pin.lng, pin.lat, mapW, mapH, 24);
    const px = Math.round(mapLeft + lx - polaroidSize / 2);
    const py = Math.round(mapTop + ly - polaroidSize * 0.72);
    pinPts.push([mapLeft + lx, mapTop + ly]);

    const polaroid = await sharp(path.join(GEN, pin.file))
      .extract({ left: 40, top: 40, width: 944, height: 820 })
      .resize({ width: polaroidSize, height: Math.round(polaroidSize * 1.12) })
      .png()
      .toBuffer();
    layers.push({ input: polaroid, left: px, top: py });

    const label = await textPng(pin.name, 160, 22);
    layers.push({
      input: label,
      left: px + Math.round(polaroidSize / 2) - 80,
      top: py + polaroidSize + 4,
    });
  }

  const [a, b, c] = pinPts;
  const dash = Buffer.from(`<svg width="${W}" height="${H}">
    <path d="M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)} L${c[0].toFixed(1)} ${c[1].toFixed(1)}"
      fill="none" stroke="#33475B" stroke-width="2.2" stroke-dasharray="5 7" stroke-linecap="round"/>
  </svg>`);
  layers.splice(2, 0, { input: dash, left: 0, top: 0 });

  const title = await textPng('한달음', 820, 88);
  const line1 = await textPng('이번 달, 발자국만 모아도', 900, 36);
  const line2 = await textPng('한 장이 된다', 900, 36);

  layers.push(
    { input: title, left: Math.round((W - 820) / 2), top: Math.round(H * 0.68) },
    { input: line1, left: Math.round((W - 900) / 2), top: Math.round(H * 0.76) },
    { input: line2, left: Math.round((W - 900) / 2), top: Math.round(H * 0.8) },
  );

  await sharp(desk)
    .composite(layers)
    .png()
    .toFile(path.join(PROMO, 'ig-b-paper-map.png'));
  console.log('Wrote ig-b-paper-map.png');
}

async function main() {
  const sharp = (await import('sharp')).default;
  await paperMap(sharp);

  await overlayMark(
    sharp,
    path.join(GEN, 'ig-a-recap-board.png'),
    path.join(PROMO, 'ig-a-recap-board.png'),
    { xRatio: 0.9, yRatio: 0.04, hRatio: 0.07 },
  );

  await overlayMark(
    sharp,
    path.join(GEN, 'ig-b-stamps.png'),
    path.join(PROMO, 'ig-b-stamps.png'),
    { xRatio: 0.5, yRatio: 0.045, hRatio: 0.055 },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
