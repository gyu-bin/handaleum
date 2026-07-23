import { queryClient } from '@/lib/queryClient';

import { photosQueryKeys } from '../hooks/photosQueryKeys';
import type { MonthKey, MonthSummary } from '../types';
import { isAppForeground, waitForAppForeground } from './appForeground';
import { loadMonthSummaries, loadMonthlyPhotos } from './mediaLibrary';

/**
 * After the viewed month finishes, warm GPS caches for other months:
 * neighbors first, then remaining months newest → oldest.
 * Pauses while backgrounded; resumes on return (assetLoc already persisted).
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
  try {
    await waitForAppForeground();
    await queryClient.fetchQuery({
      queryKey: photosQueryKeys.monthly(month),
      queryFn: () =>
        loadMonthlyPhotos(month, {
          onPartial: (partial) => {
            queryClient.setQueryData(photosQueryKeys.monthly(month), partial);
          },
          shouldContinue: isAppForeground,
        }),
    });
  } finally {
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
      await waitForAppForeground();
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

/** Test / rare reset — not used by UI. */
export function resetMonthWarmupForTests(): void {
  startedForSession = false;
  queue = [];
  running = false;
  activeMonth = null;
}
