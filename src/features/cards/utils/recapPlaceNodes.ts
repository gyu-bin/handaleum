import { placeBucketKey } from '../../photos/services/placeCache';
import { peekResolvedPlace } from '../../photos/services/placeResolve';
import type { PhotoRef, VisitPlace } from '../../photos/types';
import {
  placeIdentity,
  recapDayPhotos,
  type RecapBoardMode,
  type RecapBoardNode,
} from './recapBoard';

export function recapPhotoPlaceId(photo: PhotoRef): string {
  const place = peekResolvedPlace(photo.lat, photo.lng);
  return place
    ? placeIdentity(place)
    : `pending:${placeBucketKey(photo.lat, photo.lng)}`;
}

/** Photos belonging to a day (`YYYY-MM-DD`) or place identity node. */
export function recapNodePhotos(
  nodeId: string,
  mode: RecapBoardMode,
  photos: PhotoRef[],
): PhotoRef[] {
  return mode === 'day'
    ? recapDayPhotos(nodeId, photos)
    : [...photos.filter((photo) => recapPhotoPlaceId(photo) === nodeId)].sort(
        (a, b) => a.takenAt.localeCompare(b.takenAt),
      );
}

/** First pin-cover that still belongs to this node's photos. */
export function pinCoverAmongPhotos(
  photos: PhotoRef[],
  pinCovers: Record<string, string>,
): string | null {
  const ids = new Set(photos.map((photo) => photo.assetId));
  for (const photo of photos) {
    const cover = pinCovers[placeBucketKey(photo.lat, photo.lng)];
    if (cover && ids.has(cover)) {
      return cover;
    }
  }
  return null;
}

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
    const id = recapPhotoPlaceId(photo);
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
