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
