export interface CollageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 인생네컷-style photo rects for 1–4 photos inside a W×H box with `gutter` gaps.
 * 1: full · 2: two columns · 3: big top + two below · 4: 2×2.
 * Shared by the static card template and the interactive drag-to-swap editor so
 * the arrangement the user drags is exactly what the exported card renders.
 */
export function collageRects(
  count: number,
  W: number,
  H: number,
  gutter: number,
): CollageRect[] {
  const g = gutter;
  const n = Math.max(1, Math.min(4, count));

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
  const w = (W - g) / 2;
  const h = (H - g) / 2;
  return [
    { x: 0, y: 0, w, h },
    { x: w + g, y: 0, w, h },
    { x: 0, y: h + g, w, h },
    { x: w + g, y: h + g, w, h },
  ];
}
