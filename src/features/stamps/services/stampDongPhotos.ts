import type { PhotoRef } from '@/features/photos/types';
import { isKoreaLatLng } from '@/features/photos/utils/koreaBounds';

import { stampId } from './dongIndex';
import { lookupDong } from './dongLookup';
import { readLocatedPhotosSnapshot } from './locatedPhotosSnapshot';

let indexedAt = 0;
let indexByStampId: Map<string, PhotoRef[]> | null = null;
let indexPromise: Promise<void> | null = null;

function pushPhoto(map: Map<string, PhotoRef[]>, id: string, photo: PhotoRef): void {
  const list = map.get(id);
  if (list) {
    list.push(photo);
    return;
  }
  map.set(id, [photo]);
}

function buildIndexFromPhotos(photos: PhotoRef[]): void {
  const next = new Map<string, PhotoRef[]>();
  for (const photo of photos) {
    if (!isKoreaLatLng(photo.lat, photo.lng)) {
      continue;
    }
    const hit = lookupDong(photo.lat, photo.lng);
    if (!hit) {
      continue;
    }
    pushPhoto(next, stampId(hit.sido, hit.city, hit.name), photo);
  }
  for (const list of next.values()) {
    list.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  }
  indexByStampId = next;
  indexedAt = Date.now();
}

async function buildIndex(): Promise<void> {
  const photos = (await readLocatedPhotosSnapshot()) ?? [];
  buildIndexFromPhotos(photos);
}

async function ensureIndex(): Promise<void> {
  if (indexByStampId) {
    return;
  }
  if (!indexPromise) {
    indexPromise = buildIndex().finally(() => {
      indexPromise = null;
    });
  }
  await indexPromise;
}

/** Drop memoized index (e.g. before rewriting the GPS snapshot). */
export function resetStampDongPhotoIndex(): void {
  indexByStampId = null;
  indexedAt = 0;
  indexPromise = null;
}

/**
 * Warm the leaf→photos map after sync / on cold start so the first dong
 * popup does not wait on a full PIP pass.
 */
export async function prebuildStampDongPhotoIndex(
  photos?: PhotoRef[],
): Promise<void> {
  if (photos) {
    buildIndexFromPhotos(photos);
    return;
  }
  await ensureIndex();
}

export type StampDongPhotosQuery = {
  sido: string;
  city: string;
  leaf: string;
};

/**
 * Photos for a stamp leaf via offline PIP over the GPS snapshot.
 * Prefers a prebuilt index; otherwise builds once per session.
 */
export async function photosForStampLeaf(
  query: StampDongPhotosQuery,
): Promise<PhotoRef[]> {
  await ensureIndex();
  const id = stampId(query.sido, query.city, query.leaf);
  return indexByStampId?.get(id) ?? [];
}

/**
 * Sync read when the leaf→photos index is already warm (post-sync / cold prebuild).
 * `null` = index not ready yet — caller should await {@link photosForStampLeaf}.
 */
export function peekPhotosForStampLeaf(
  query: StampDongPhotosQuery,
): PhotoRef[] | null {
  if (!indexByStampId) {
    return null;
  }
  const id = stampId(query.sido, query.city, query.leaf);
  return indexByStampId.get(id) ?? [];
}

/** Test helper. */
export function stampDongPhotoIndexBuiltAt(): number {
  return indexedAt;
}
