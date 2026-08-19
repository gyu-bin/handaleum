import { getRecapCoversRaw, setRecapCoversRaw } from '@/lib/storage';

import { monthKeySchema } from '@/features/photos/schema';
import type { MonthKey } from '@/features/photos/types';

/** recap node id (day `YYYY-MM-DD` or place identity) → assetId */
export type RecapCoverMap = Record<string, string>;

export function readRecapCovers(month: MonthKey): RecapCoverMap {
  const parsedKey = monthKeySchema.safeParse(month);
  if (!parsedKey.success) {
    return {};
  }
  const key = parsedKey.data;
  const raw = getRecapCoversRaw(key);
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const out: RecapCoverMap = {};
    for (const [nodeId, assetId] of Object.entries(parsed)) {
      if (typeof nodeId === 'string' && typeof assetId === 'string' && assetId.length > 0) {
        out[nodeId] = assetId;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeRecapCover(
  month: MonthKey,
  nodeId: string,
  assetId: string,
): RecapCoverMap {
  const key = monthKeySchema.parse(month);
  const next = { ...readRecapCovers(key), [nodeId]: assetId };
  setRecapCoversRaw(key, JSON.stringify(next));
  return next;
}
