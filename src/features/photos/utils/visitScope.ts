/**
 * Map scale → visit list admin grain.
 * Thresholds tuned for ResumableZoom fit (~1.35–3.5) and max 18.
 */
import type { VisitAdminLevel } from '../types';

const CITY_MIN_SCALE = 2.4;
const DONG_MIN_SCALE = 5.5;

export function visitLevelFromScale(scale: number): VisitAdminLevel {
  if (scale >= DONG_MIN_SCALE) {
    return 'dong';
  }
  if (scale >= CITY_MIN_SCALE) {
    return 'city';
  }
  return 'province';
}
