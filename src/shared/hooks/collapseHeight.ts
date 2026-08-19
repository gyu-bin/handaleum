/** Ignore end-bounce / list-height feedback that looks like a tiny up-scroll. */
const END_SLACK = 24;

/** Accrue collapse from scroll delta so up-scroll expands before y hits 0. */
export function collapseTravel(
  collapseY: number,
  y: number,
  dy: number,
  range: number,
  maxScroll: number,
): number {
  'worklet';
  if (y <= 0 || range <= 0) {
    return 0;
  }
  if (Math.abs(dy) < 0.5) {
    return collapseY;
  }
  // At the content end, bounce and header-height clamp produce negative dy.
  if (y >= maxScroll - END_SLACK && dy < 0) {
    return collapseY;
  }
  return Math.min(range, Math.max(0, collapseY + dy));
}

/** Pure collapse height (also used from Reanimated worklets). */
export function collapseHeight(
  scrollY: number,
  expandedH: number,
  range: number,
  minRatio: number,
): number {
  'worklet';
  if (expandedH <= 0) {
    return 0;
  }
  if (range <= 0 || scrollY <= 0) {
    return expandedH;
  }
  if (scrollY >= range) {
    return expandedH * minRatio;
  }
  const t = scrollY / range;
  return expandedH + (expandedH * minRatio - expandedH) * t;
}
