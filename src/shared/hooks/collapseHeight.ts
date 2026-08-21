/** Ignore end-bounce / list-height feedback that looks like a tiny up-scroll. */
const END_SLACK = 24;

export const COLLAPSE_SNAP_MS = 180;
export const COLLAPSE_FLING_VY = 420;

/** Accrue collapse from scroll delta so up-scroll expands before y hits 0. */
export function collapseTravel(
  collapseY: number,
  y: number,
  dy: number,
  range: number,
  maxScroll: number,
  deadzone = 0,
  /** When true, up-scroll does not expand until the list is at the top. */
  expandOnlyAtTop = false,
): number {
  'worklet';
  if (range <= 0) {
    return 0;
  }
  if (y <= 0 && !expandOnlyAtTop) {
    return 0;
  }
  if (Math.abs(dy) < 0.5) {
    return collapseY;
  }
  // At the content end, bounce and header-height clamp produce negative dy.
  if (y >= maxScroll - END_SLACK && dy < 0) {
    return collapseY;
  }
  if (y < deadzone && dy > 0) {
    return collapseY;
  }
  if (expandOnlyAtTop && dy < 0) {
    return collapseY;
  }
  return Math.min(range, Math.max(0, collapseY + dy));
}

/** Finger-up snap. Latch keeps a hidden preview hidden even at y === 0. */
export function collapseScrollSnapTarget(
  y: number,
  range: number,
  deadzone = 0,
  collapseY = 0,
): number {
  'worklet';
  if (y > deadzone) {
    return range;
  }
  return collapseY < range * 0.5 ? 0 : range;
}

/** Header-pull snap: fling or past midpoint opens/closes the preview. */
export function collapsePanSnapTarget(
  collapseY: number,
  velocityY: number,
  range: number,
): number {
  'worklet';
  if (velocityY > COLLAPSE_FLING_VY) {
    return 0;
  }
  if (velocityY < -COLLAPSE_FLING_VY) {
    return range;
  }
  return collapseY < range * 0.5 ? 0 : range;
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
