import type { PhotoRef } from '@/features/photos/types';
import { isKoreaLatLng } from '@/features/photos/utils/koreaBounds';

import { stampId } from './dongIndex';
import { lookupDong } from './dongLookup';
import { readLocatedPhotosSnapshot } from './locatedPhotosSnapshot';
import { forEachPipChunk } from './pipChunk';

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

async function buildIndexFromPhotos(photos: PhotoRef[]): Promise<void> {
  const next = new Map<string, PhotoRef[]>();
  await forEachPipChunk(photos, (photo) => {
    if (!isKoreaLatLng(photo.lat, photo.lng)) {
      return;
    }
    const hit = lookupDong(photo.lat, photo.lng);
    if (!hit) {
      return;
    }
    pushPhoto(next, stampId(hit.sido, hit.city, hit.name), photo);
  });
  for (const list of next.values()) {
    list.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  }
  indexByStampId = next;
  indexedAt = Date.now();
}

/**
 * Add photos into the warm leaf index (dedupe by assetId). Does not replace
 * the snapshot-backed index — live 발도장 can mint a 동 before the weekly GPS
 * snapshot contains today's shots.
 */
export async function mergePhotosIntoDongIndex(
  photos: PhotoRef[],
): Promise<void> {
  if (photos.length === 0) {
    return;
  }
  if (!indexByStampId) {
    indexByStampId = new Map();
  }
  const map = indexByStampId;
  let changed = false;
  await forEachPipChunk(photos, (photo) => {
    if (!isKoreaLatLng(photo.lat, photo.lng)) {
      return;
    }
    const hit = lookupDong(photo.lat, photo.lng);
    if (!hit) {
      return;
    }
    const id = stampId(hit.sido, hit.city, hit.name);
    const list = map.get(id) ?? [];
    if (list.some((row) => row.assetId === photo.assetId)) {
      return;
    }
    list.push(photo);
    list.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    map.set(id, list);
    changed = true;
  });
  if (changed) {
    indexedAt = Date.now();
  }
}

export async function mergeMonthPhotosIntoDongIndex(
  photos: PhotoRef[],
): Promise<void> {
  await ensureIndex();
  await mergePhotosIntoDongIndex(photos);
}

async function buildIndex(): Promise<void> {
  const photos = (await readLocatedPhotosSnapshot()) ?? [];
  await buildIndexFromPhotos(photos);
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
    await buildIndexFromPhotos(photos);
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
