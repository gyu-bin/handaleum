import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';

import { storage } from '@/lib/storage';

/** Cap on-disk pin thumbs — visible pins + some scroll backlog, not whole library. */
const MAX_DISK_THUMBS = 400;
const LRU_KEY = 'pinThumbLru';
const DIR_NAME = 'pin-thumbs-v1';

function thumbDir(): string | null {
  if (!cacheDirectory) {
    return null;
  }
  return `${cacheDirectory}${DIR_NAME}/`;
}

function safeFileName(assetId: string): string {
  return `${assetId.replace(/[^a-zA-Z0-9._-]/g, '_')}.jpg`;
}

function thumbPath(assetId: string): string | null {
  const dir = thumbDir();
  if (!dir) {
    return null;
  }
  return `${dir}${safeFileName(assetId)}`;
}

function readLru(): string[] {
  const raw = storage.getString(LRU_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function writeLru(ids: string[]): void {
  storage.set(LRU_KEY, JSON.stringify(ids));
}

function touchLru(assetId: string): void {
  const next = readLru().filter((id) => id !== assetId);
  next.push(assetId);
  writeLru(next);
}

async function ensureDir(): Promise<string | null> {
  const dir = thumbDir();
  if (!dir) {
    return null;
  }
  const info = await getInfoAsync(dir);
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

async function evictIfNeeded(): Promise<void> {
  let ids = readLru();
  if (ids.length <= MAX_DISK_THUMBS) {
    return;
  }
  const overflow = ids.length - MAX_DISK_THUMBS;
  const doomed = ids.slice(0, overflow);
  ids = ids.slice(overflow);
  writeLru(ids);
  await Promise.all(
    doomed.map(async (id) => {
      const path = thumbPath(id);
      if (!path) {
        return;
      }
      try {
        await deleteAsync(path, { idempotent: true });
      } catch (error) {
        console.warn('pin thumb evict failed', id, error);
      }
    }),
  );
}

/**
 * Return a durable cache:// file URI for a pin thumb if present.
 */
export async function readPinThumbFromDisk(
  assetId: string,
): Promise<string | null> {
  const path = thumbPath(assetId);
  if (!path) {
    return null;
  }
  try {
    const info = await getInfoAsync(path);
    if (info.exists && !info.isDirectory) {
      touchLru(assetId);
      return path;
    }
  } catch (error) {
    console.warn('pin thumb disk read failed', assetId, error);
  }
  return null;
}

/**
 * Persist a manipulator (or other file://) thumb under a stable assetId path.
 * Evicts oldest entries past MAX_DISK_THUMBS.
 */
export async function writePinThumbToDisk(
  assetId: string,
  sourceFileUri: string,
): Promise<string | null> {
  if (!sourceFileUri.startsWith('file:') && !sourceFileUri.startsWith('content:')) {
    return null;
  }
  try {
    const dir = await ensureDir();
    const dest = thumbPath(assetId);
    if (!dir || !dest) {
      return null;
    }
    await copyAsync({ from: sourceFileUri, to: dest });
    touchLru(assetId);
    await evictIfNeeded();
    return dest;
  } catch (error) {
    console.warn('pin thumb disk write failed', assetId, error);
    return null;
  }
}
