import type { PhotoRef } from '../../photos/types';

/** "2026-07" → "2026. 07" — instrument-plate month label. */
export function formatMonthDot(month: string): string {
  const [year, mon] = month.split('-');
  return `${year}. ${mon}`;
}

/**
 * Rough survey coordinate for the card: the centroid of the photo pins,
 * formatted like a plate annotation ("36.5°N 127.8°E"). Empty when no pins.
 */
export function cardCentroid(
  photoRefs: PhotoRef[],
): { lat: number; lng: number } | null {
  if (photoRefs.length === 0) {
    return null;
  }
  const lat = photoRefs.reduce((sum, p) => sum + p.lat, 0) / photoRefs.length;
  const lng = photoRefs.reduce((sum, p) => sum + p.lng, 0) / photoRefs.length;
  return { lat, lng };
}

export function cardCoordinate(photoRefs: PhotoRef[]): string {
  const center = cardCentroid(photoRefs);
  if (!center) {
    return '';
  }
  const { lat, lng } = center;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lng).toFixed(1)}°${ew}`;
}
