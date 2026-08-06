import type { PhotoRef } from '@/features/photos/types';
import { isKoreaLatLng } from '@/features/photos/utils/koreaBounds';

import { stampId } from './dongIndex';
import { lookupDong } from './dongLookup';
import { readLocatedPhotosSnapshot } from './locatedPhotosSnapshot';

/** Cap UI grid — enough to feel rich, not a full album dump. */
const MAX_PHOTOS_PER_LEAF = 60;

let indexedAt = 0;
let indexByStampId: Map<string, PhotoRef[]> | null = null;
let indexPromise: Promise<void> | null = null;

function pushPhoto(map: Map<string, PhotoRef[]>, id: string, photo: PhotoRef): void {
  const list = map.get(id);
  if (list) {
    if (list.length < MAX_PHOTOS_PER_LEAF) {
      list.push(photo);
    }
    return;
  }
  map.set(id, [photo]);
}

async function buildIndex(): Promise<void> {
  const photos = (await readLocatedPhotosSnapshot()) ?? [];
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
  // Newest first within each leaf.
  for (const list of next.values()) {
    list.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  }
  indexByStampId = next;
  indexedAt = Date.now();
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

/** Drop memoized index (e.g. after a fresh library sync). */
export function resetStampDongPhotoIndex(): void {
  indexByStampId = null;
  indexedAt = 0;
  indexPromise = null;
}

export type StampDongPhotosQuery = {
  sido: string;
  city: string;
  leaf: string;
};

/**
 * Photos for a stamp leaf via offline PIP over the GPS snapshot (approach B).
 * First call builds a session index; later leaves are instant.
 */
export async function photosForStampLeaf(
  query: StampDongPhotosQuery,
): Promise<PhotoRef[]> {
  await ensureIndex();
  const id = stampId(query.sido, query.city, query.leaf);
  return indexByStampId?.get(id) ?? [];
}

/** Test helper. */
export function stampDongPhotoIndexBuiltAt(): number {
  return indexedAt;
}
