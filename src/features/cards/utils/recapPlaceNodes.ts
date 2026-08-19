import { placeBucketKey } from '../../photos/services/placeCache';
import { peekResolvedPlace } from '../../photos/services/placeResolve';
import type { PhotoRef, VisitPlace } from '../../photos/types';
import { placeIdentity, type RecapBoardNode } from './recapBoard';

/**
 * One node per visit-place identity. Cover = earliest photo in that place.
 * Unresolved GPS buckets stay as their own node until geocode lands.
 */
export function recapPlaceNodes(
  photos: PhotoRef[],
  visitPlaces: VisitPlace[],
): RecapBoardNode[] {
  const photosByIdentity = new Map<string, PhotoRef[]>();
  for (const photo of photos) {
    const place = peekResolvedPlace(photo.lat, photo.lng);
    const id = place
      ? placeIdentity(place)
      : `pending:${placeBucketKey(photo.lat, photo.lng)}`;
    const list = photosByIdentity.get(id);
    if (list) {
      list.push(photo);
    } else {
      photosByIdentity.set(id, [photo]);
    }
  }

  if (visitPlaces.length > 0) {
    const used = new Set<string>();
    const nodes: RecapBoardNode[] = [];
    for (const visit of visitPlaces) {
      const id = placeIdentity(visit);
      used.add(id);
      const list = [...(photosByIdentity.get(id) ?? [])].sort((a, b) =>
        a.takenAt.localeCompare(b.takenAt),
      );
      nodes.push({
        id,
        label: visit.label,
        assetId: list[0]?.assetId ?? null,
        photoCount: list.length,
      });
    }
    const leftovers = [...photosByIdentity.entries()]
      .filter(([id]) => !used.has(id) && id.startsWith('pending:'))
      .sort((a, b) => {
        const aAt = a[1][0]?.takenAt ?? '';
        const bAt = b[1][0]?.takenAt ?? '';
        return aAt.localeCompare(bAt);
      });
    for (const [id, list] of leftovers) {
      const sorted = [...list].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
      nodes.push({
        id,
        label: '',
        assetId: sorted[0]?.assetId ?? null,
        photoCount: sorted.length,
      });
    }
    return nodes.filter((node) => node.photoCount > 0 || node.assetId);
  }

  return [...photosByIdentity.entries()]
    .map(([id, list]) => {
      const sorted = [...list].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
      const place = sorted[0]
        ? peekResolvedPlace(sorted[0].lat, sorted[0].lng)
        : null;
      return {
        id,
        label: place?.detailLabel ?? '',
        assetId: sorted[0]?.assetId ?? null,
        photoCount: sorted.length,
        firstTakenAt: sorted[0]?.takenAt ?? '',
      };
    })
    .sort((a, b) => a.firstTakenAt.localeCompare(b.firstTakenAt))
    .map(({ firstTakenAt: _t, ...node }) => node);
}
