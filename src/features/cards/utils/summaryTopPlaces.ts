import { placeBucketKey } from '../../photos/services/placeCache';
import { peekResolvedPlace } from '../../photos/services/placeResolve';
import type { PhotoRef, VisitPlace } from '../../photos/types';

import { placeIdentity } from './recapBoard';
import { pinCoverAmongPhotos } from './recapPlaceNodes';
import { rankSummaryTopPlaces } from './rankSummaryTopPlaces';

export type SummaryTopPlace = {
  /** Admin identity (or pending GPS bucket) — stable across geocode refresh. */
  identity: string;
  label: string;
  photoCount: number;
  coverAssetId: string;
  /** Latest photo takenAt in this place (ISO). */
  latestTakenAt: string;
  photos: PhotoRef[];
};

function photoIdentity(photo: PhotoRef): string {
  const resolved = peekResolvedPlace(photo.lat, photo.lng);
  if (resolved) {
    return placeIdentity(resolved);
  }
  return `pending:${placeBucketKey(photo.lat, photo.lng)}`;
}

function labelForIdentity(
  identity: string,
  visitPlaces: VisitPlace[],
  sample: PhotoRef,
): string {
  if (identity.startsWith('pending:')) {
    return '';
  }
  const visit = visitPlaces.find((place) => placeIdentity(place) === identity);
  if (visit?.label) {
    return visit.label;
  }
  return peekResolvedPlace(sample.lat, sample.lng)?.detailLabel ?? '';
}

/**
 * Top places for the 요약 tab: same admin identity as journey/visitPlaces,
 * ranked by photo count (desc), then latest visit (desc). No new clustering.
 */
export function summaryTopPlaces(
  photos: PhotoRef[],
  visitPlaces: VisitPlace[],
  pinCovers: Record<string, string>,
  limit = 4,
): SummaryTopPlace[] {
  if (photos.length === 0 || limit <= 0) {
    return [];
  }

  const groups = new Map<string, PhotoRef[]>();
  for (const photo of photos) {
    const id = photoIdentity(photo);
    const list = groups.get(id);
    if (list) {
      list.push(photo);
    } else {
      groups.set(id, [photo]);
    }
  }

  const rows: SummaryTopPlace[] = [];
  for (const [identity, group] of groups) {
    const sorted = [...group].sort((a, b) =>
      a.takenAt.localeCompare(b.takenAt),
    );
    const sample = sorted[0]!;
    const latest = sorted[sorted.length - 1]!;
    const pinCover = pinCoverAmongPhotos(sorted, pinCovers);
    const coverAssetId =
      pinCover && sorted.some((p) => p.assetId === pinCover)
        ? pinCover
        : sample.assetId;
    const label = labelForIdentity(identity, visitPlaces, sample);
    if (!label) {
      // Still geocoding — skip until a readable label exists.
      continue;
    }
    rows.push({
      identity,
      label,
      photoCount: sorted.length,
      coverAssetId,
      latestTakenAt: latest.takenAt,
      photos: sorted,
    });
  }

  return rankSummaryTopPlaces(rows, limit);
}
