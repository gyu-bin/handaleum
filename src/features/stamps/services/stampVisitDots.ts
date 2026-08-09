import type { StampsCollected } from '../types';
import { centroidForDongId } from './dongLookup';
import { stampId } from './dongIndex';

export type StampVisitDot = {
  id: string;
  lat: number;
  lng: number;
  /** Short 시·도 key for pastel blob color. */
  sido: string;
};

/**
 * One glance-map blob per collected 동/읍·면 (atlas centroid).
 * Skips leaves missing from `dongs.json` rather than guessing.
 */
export function visitDotsFromCollected(
  collected: StampsCollected,
): StampVisitDot[] {
  const dots: StampVisitDot[] = [];
  for (const [id, entry] of Object.entries(collected)) {
    const center =
      centroidForDongId(id) ??
      centroidForDongId(stampId(entry.sido, entry.city, entry.name));
    if (!center) {
      continue;
    }
    dots.push({ id, lat: center.lat, lng: center.lng, sido: entry.sido });
  }
  return dots;
}
