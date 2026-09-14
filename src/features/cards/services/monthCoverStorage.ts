import { getMonthCoverRaw, setMonthCoverRaw } from '@/lib/storage';

import { monthKeySchema } from '@/features/photos/schema';
import type { MonthKey } from '@/features/photos/types';

/** Summary hero cover assetId for a month, or null if unset/invalid. */
export function readMonthCover(month: MonthKey): string | null {
  const parsedKey = monthKeySchema.safeParse(month);
  if (!parsedKey.success) {
    return null;
  }
  const raw = getMonthCoverRaw(parsedKey.data);
  if (!raw || raw.length === 0) {
    return null;
  }
  return raw;
}

export function writeMonthCover(month: MonthKey, assetId: string): string {
  const key = monthKeySchema.parse(month);
  if (assetId.length === 0) {
    throw new Error('month cover assetId must be non-empty');
  }
  setMonthCoverRaw(key, assetId);
  return assetId;
}
