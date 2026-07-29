export interface CollageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const COLLAGE_MAX = 5;

/**
 * Photo rects for 1–5 photos inside a W×H box with `gutter` gaps.
 * 1: full · 2: two columns · 3: big top + two below · 4: 2×2 ·
 * 5: three on top + two below.
 * Shared by the static card template and the interactive drag-to-swap editor.
 */
export function collageRects(
  count: number,
  W: number,
  H: number,
  gutter: number,
): CollageRect[] {
  const g = gutter;
  const n = Math.max(1, Math.min(COLLAGE_MAX, count));

  if (n === 1) {
    return [{ x: 0, y: 0, w: W, h: H }];
  }
  if (n === 2) {
    const w = (W - g) / 2;
    return [
      { x: 0, y: 0, w, h: H },
      { x: w + g, y: 0, w, h: H },
    ];
  }
  if (n === 3) {
    const topH = (H - g) * 0.56;
    const botH = H - g - topH;
    const w = (W - g) / 2;
    const by = topH + g;
    return [
      { x: 0, y: 0, w: W, h: topH },
      { x: 0, y: by, w, h: botH },
      { x: w + g, y: by, w, h: botH },
    ];
  }
  if (n === 4) {
    const w = (W - g) / 2;
    const h = (H - g) / 2;
    return [
      { x: 0, y: 0, w, h },
      { x: w + g, y: 0, w, h },
      { x: 0, y: h + g, w, h },
      { x: w + g, y: h + g, w, h },
    ];
  }

  // 5: three across the top, two across the bottom
  const topH = (H - g) / 2;
  const botH = H - g - topH;
  const tw = (W - 2 * g) / 3;
  const bw = (W - g) / 2;
  const by = topH + g;
  return [
    { x: 0, y: 0, w: tw, h: topH },
    { x: tw + g, y: 0, w: tw, h: topH },
    { x: 2 * (tw + g), y: 0, w: tw, h: topH },
    { x: 0, y: by, w: bw, h: botH },
    { x: bw + g, y: by, w: bw, h: botH },
  ];
}
