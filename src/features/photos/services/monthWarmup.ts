import { queryClient } from '@/lib/queryClient';

import { photosQueryKeys } from '../hooks/photosQueryKeys';
import type { MonthKey, MonthSummary } from '../types';
import {
  releaseIndexingBackground,
  retainIndexingBackground,
} from './indexingBackground';
import {
  isFullAlbumScanBusy,
  loadMonthSummaries,
  loadMonthlyPhotos,
} from './mediaLibrary';

/** Don't race MediaLibrary with the full-album stamp GPS scan. */
async function waitWhileAlbumScan(): Promise<void> {
  while (isFullAlbumScanBusy()) {
    await new Promise((r) => setTimeout(r, 400));
  }
}

/**
 * After the viewed month finishes, warm GPS caches for other months:
 * neighbors first, then remaining months newest → oldest.
 * Continues while backgrounded (UIBackgroundTask); pauses only for album scan.
 */

let startedForSession = false;
let queue: MonthKey[] = [];
let running = false;
let activeMonth: MonthKey | null = null;

function neighborThenRestOrder(
  months: MonthKey[],
  current: MonthKey,
): MonthKey[] {
  const sorted = [...months].sort((a, b) => b.localeCompare(a));
  const idx = sorted.indexOf(current);
  if (idx < 0) {
    return sorted.filter((m) => m !== current);
  }

  const neighbors: MonthKey[] = [];
  for (let distance = 1; distance < sorted.length; distance += 1) {
    const newer = sorted[idx - distance];
    const older = sorted[idx + distance];
    if (newer != null) {
      neighbors.push(newer);
    }
    if (older != null) {
      neighbors.push(older);
    }
  }
  return neighbors;
}

async function ensureSummaries(): Promise<MonthSummary[]> {
  const cached = queryClient.getQueryData<MonthSummary[]>(photosQueryKeys.summaries);
  if (cached && cached.length > 0) {
    return cached;
  }
  return queryClient.fetchQuery({
    queryKey: photosQueryKeys.summaries,
    queryFn: loadMonthSummaries,
    staleTime: 10 * 60 * 1000,
  });
}

async function warmOne(month: MonthKey): Promise<void> {
  activeMonth = month;
  retainIndexingBackground();
  try {
    await waitWhileAlbumScan();
    await queryClient.fetchQuery({
      queryKey: photosQueryKeys.monthly(month),
      queryFn: () =>
        loadMonthlyPhotos(month, {
          onPartial: (partial) => {
            queryClient.setQueryData(photosQueryKeys.monthly(month), partial);
          },
          shouldContinue: () => !isFullAlbumScanBusy(),
        }),
    });
  } finally {
    releaseIndexingBackground();
    if (activeMonth === month) {
      activeMonth = null;
    }
  }
}

async function drainQueue(): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    while (queue.length > 0) {
      await waitWhileAlbumScan();
      const next = queue.shift();
      if (next == null) {
        break;
      }
      try {
        await warmOne(next);
      } catch (error) {
        console.error('month warmup failed', next, error);
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Kick off once per JS session after the current month has fully loaded.
 * Safe to call repeatedly — subsequent calls are no-ops unless force.
 * Neighbors are also prefetched immediately via {@link prefetchNeighborMonths}.
 */
export function startMonthWarmup(currentMonth: MonthKey): void {
  if (startedForSession) {
    return;
  }
  startedForSession = true;

  void (async () => {
    try {
      const summaries = await ensureSummaries();
      const months = summaries.map((s) => s.month);
      queue = neighborThenRestOrder(months, currentMonth);
      await drainQueue();
    } catch (error) {
      console.error('month warmup bootstrap failed', error);
      // Allow a later remount / month change to retry bootstrap.
      startedForSession = false;
    }
  })();
}

/** Immediate GPS cache warm for ±1 month (home ‹ ›). Idempotent per key. */
export function prefetchNeighborMonths(
  prev: MonthKey | null,
  next: MonthKey | null,
): void {
  for (const month of [prev, next]) {
    if (!month) {
      continue;
    }
    void queryClient.prefetchQuery({
      queryKey: photosQueryKeys.monthly(month),
      queryFn: () =>
        loadMonthlyPhotos(month, {
          onPartial: (partial) => {
            queryClient.setQueryData(photosQueryKeys.monthly(month), partial);
          },
          shouldContinue: () => !isFullAlbumScanBusy(),
        }),
    });
  }
}

/** Test / rare reset — not used by UI. */
export function resetMonthWarmupForTests(): void {
  startedForSession = false;
  queue = [];
  running = false;
  activeMonth = null;
}
