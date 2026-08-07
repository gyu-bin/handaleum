import {
  cacheDirectory,
  deleteAsync,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { z } from 'zod';

import { photoRefSchema } from '@/features/photos/schema';
import type { PhotoRef } from '@/features/photos/types';

/**
 * Persist located PhotoRef[] after the stamp GPS phase so a killed geocode
 * can resume without re-listing the camera roll.
 */

const FILE_NAME = 'stamps-located-v1.json';

const snapshotSchema = z.object({
  savedAt: z.number().finite(),
  photos: z.array(photoRefSchema),
});

function snapshotUri(): string | null {
  if (!cacheDirectory) {
    return null;
  }
  return `${cacheDirectory}${FILE_NAME}`;
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
    await writeAsStringAsync(uri, body);
  } catch (error) {
    console.warn('[stamps] located snapshot write failed', error);
  }
}

export async function readLocatedPhotosSnapshot(): Promise<PhotoRef[] | null> {
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
  const uri = snapshotUri();
  if (!uri) {
    return;
  }
  try {
    await deleteAsync(uri, { idempotent: true });
  } catch (error) {
    console.warn('[stamps] located snapshot clear failed', error);
  }
}

/** Cheap existence check — avoid JSON parse when deciding GPS skip. */
export async function hasLocatedPhotosSnapshot(): Promise<boolean> {
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
