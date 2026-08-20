import { placeBucketKey } from '../../photos/services/placeCache';
import { peekResolvedPlace } from '../../photos/services/placeResolve';
import type { PhotoRef, VisitPlace } from '../../photos/types';
import {
  groupPhotosByPlaceDay,
  localDayKey,
  placeIdentity,
  placeIdentityFromVisitNodeId,
  placeVisitNodeId,
  recapDayPhotos,
  type RecapBoardMode,
  type RecapBoardNode,
} from './recapBoard';

function recapPlaceIdentity(photo: PhotoRef): string {
  const place = peekResolvedPlace(photo.lat, photo.lng);
  return place
    ? placeIdentity(place)
    : `pending:${placeBucketKey(photo.lat, photo.lng)}`;
}

export function recapPhotoPlaceVisitId(photo: PhotoRef): string {
  return placeVisitNodeId(recapPlaceIdentity(photo), localDayKey(photo.takenAt));
}

/** Photos belonging to a day (`YYYY-MM-DD`) or place-visit node. */
export function recapNodePhotos(
  nodeId: string,
  mode: RecapBoardMode,
  photos: PhotoRef[],
): PhotoRef[] {
  return mode === 'day'
    ? recapDayPhotos(nodeId, photos)
    : [...photos.filter((photo) => recapPhotoPlaceVisitId(photo) === nodeId)].sort(
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

function labelForVisitIdentity(
  identity: string,
  visitPlaces: VisitPlace[],
  sample: PhotoRef | undefined,
): string {
  if (identity.startsWith('pending:')) {
    return '';
  }
  const visit = visitPlaces.find((place) => placeIdentity(place) === identity);
  if (visit?.label) {
    return visit.label;
  }
  const resolved = sample
    ? peekResolvedPlace(sample.lat, sample.lng)
    : null;
  return resolved?.detailLabel ?? '';
}

/**
 * One node per visit-place identity × local calendar day, first-photo order.
 * Unresolved GPS buckets stay as their own node until geocode lands.
 */
export function recapPlaceNodes(
  photos: PhotoRef[],
  visitPlaces: VisitPlace[],
): RecapBoardNode[] {
  return groupPhotosByPlaceDay(photos, recapPlaceIdentity).map((group) => ({
    id: group.id,
    label: labelForVisitIdentity(
      placeIdentityFromVisitNodeId(group.id),
      visitPlaces,
      group.photos[0],
    ),
    assetId: group.photos[0]?.assetId ?? null,
    photoCount: group.photos.length,
  }));
}
