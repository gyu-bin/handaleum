import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  moveAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { z } from 'zod';

import { photoRefSchema } from '@/features/photos/schema';
import type { PhotoRef } from '@/features/photos/types';

/**
 * Persist located PhotoRef[] after the stamp GPS phase so a killed geocode
 * can resume without re-listing the camera roll.
 *
 * Lives in documentDirectory — cacheDirectory is purged under disk pressure
 * while collected stamps stay in sqlite, which left 도장 with empty 동 photos.
 */

const FILE_NAME = 'stamps-located-v1.json';

const snapshotSchema = z.object({
  savedAt: z.number().finite(),
  photos: z.array(photoRefSchema),
});

function documentUri(): string | null {
  if (!documentDirectory) {
    return null;
  }
  return `${documentDirectory}${FILE_NAME}`;
}

function cacheUri(): string | null {
  if (!cacheDirectory) {
    return null;
  }
  return `${cacheDirectory}${FILE_NAME}`;
}

function snapshotUri(): string | null {
  return documentUri() ?? cacheUri();
}

async function migrateCacheToDocument(): Promise<void> {
  const dest = documentUri();
  const from = cacheUri();
  if (!dest || !from || dest === from) {
    return;
  }
  try {
    const destInfo = await getInfoAsync(dest);
    if (destInfo.exists) {
      return;
    }
    const fromInfo = await getInfoAsync(from);
    if (!fromInfo.exists || fromInfo.isDirectory) {
      return;
    }
    await moveAsync({ from, to: dest });
  } catch (error) {
    console.warn('[stamps] located snapshot migrate failed', error);
  }
}

export async function writeLocatedPhotosSnapshot(
  photos: PhotoRef[],
): Promise<void> {
  const uri = snapshotUri();
  if (!uri) {
    return;
  }
  try {
    const body = JSON.stringify({
      savedAt: Date.now(),
      photos,
    } satisfies z.infer<typeof snapshotSchema>);
    const tmp = `${uri}.tmp`;
    await writeAsStringAsync(tmp, body);
    const existing = await getInfoAsync(uri);
    if (existing.exists) {
      await deleteAsync(uri, { idempotent: true });
    }
    await moveAsync({ from: tmp, to: uri });
  } catch (error) {
    console.warn('[stamps] located snapshot write failed', error);
  }
}

export async function readLocatedPhotosSnapshot(): Promise<PhotoRef[] | null> {
  await migrateCacheToDocument();
  const uri = snapshotUri();
  if (!uri) {
    return null;
  }
  try {
    const info = await getInfoAsync(uri);
    if (!info.exists || info.isDirectory) {
      return null;
    }
    const raw = await readAsStringAsync(uri);
    const parsed: unknown = JSON.parse(raw);
    const result = snapshotSchema.safeParse(parsed);
    if (!result.success || result.data.photos.length === 0) {
      return null;
    }
    return result.data.photos;
  } catch (error) {
    console.warn('[stamps] located snapshot read failed', error);
    return null;
  }
}

export async function clearLocatedPhotosSnapshot(): Promise<void> {
  for (const uri of [documentUri(), cacheUri()]) {
    if (!uri) {
      continue;
    }
    try {
      await deleteAsync(uri, { idempotent: true });
    } catch (error) {
      console.warn('[stamps] located snapshot clear failed', error);
    }
  }
}

/** Cheap existence check — avoid JSON parse when deciding GPS skip. */
export async function hasLocatedPhotosSnapshot(): Promise<boolean> {
  await migrateCacheToDocument();
  const uri = snapshotUri();
  if (!uri) {
    return false;
  }
  try {
    const info = await getInfoAsync(uri);
    return Boolean(info.exists && !info.isDirectory);
  } catch {
    return false;
  }
}
