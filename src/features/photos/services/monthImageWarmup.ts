import { Image } from 'expo-image';

import type { MonthKey } from '../types';
import { isAppForeground, waitForAppForeground } from './appForeground';
import { resolveAssetUri } from './mediaLibrary';

/**
 * Budgeted display-image warm for pin sheet / playback / cards.
 *
 * NEVER enqueue an entire huge month — tens of thousands of Image.prefetch
 * calls thrash disk and fight pin thumb exports. Callers pass only:
 * - visible pin covers / seeds (map)
 * - open sheet page / playback window (on demand)
 *
 * Cap keeps the queue small; already-warmed ids are skipped for the session.
 */

const WARM_CONCURRENCY = 2;
const START_DELAY_MS = 1800;
/** Hard cap — covers (~30) + sheet page (50) + playback window headroom. */
const MAX_QUEUE = 120;

const warmedAssetIds = new Set<string>();

let activeMonth: MonthKey | null = null;
let generation = 0;
let queue: string[] = [];
let draining = false;
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let hasStartedDelayForMonth = false;

export interface MonthImageWarmupInput {
  month: MonthKey;
  /** Only these assets — do not pass the full month list. */
  assetIds: string[];
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function trimQueue(): void {
  if (queue.length > MAX_QUEUE) {
    queue = queue.slice(0, MAX_QUEUE);
  }
}

function enqueueFront(ids: string[]): void {
  const inQueue = new Set(queue);
  const front: string[] = [];
  for (const id of ids) {
    if (warmedAssetIds.has(id) || inQueue.has(id)) {
      continue;
    }
    front.push(id);
    inQueue.add(id);
  }
  if (front.length === 0) {
    return;
  }
  queue = [...front, ...queue.filter((id) => !front.includes(id))];
  trimQueue();
}

async function warmOne(assetId: string): Promise<void> {
  if (warmedAssetIds.has(assetId)) {
    return;
  }
  await waitForAppForeground();
  if (!isAppForeground()) {
    return;
  }
  try {
    const uri = await resolveAssetUri(assetId);
    if (!uri) {
      return;
    }
    await Image.prefetch(uri, 'memory-disk');
    warmedAssetIds.add(assetId);
  } catch (error) {
    console.warn('month image warm failed', assetId, error);
  }
}

async function drain(runId: number): Promise<void> {
  if (draining) {
    return;
  }
  draining = true;
  try {
    const worker = async () => {
      while (true) {
        if (runId !== generation) {
          return;
        }
        const assetId = queue.shift();
        if (assetId == null) {
          return;
        }
        if (warmedAssetIds.has(assetId)) {
          continue;
        }
        await waitForAppForeground();
        if (runId !== generation) {
          return;
        }
        await warmOne(assetId);
      }
    };
    await Promise.all(
      Array.from({ length: WARM_CONCURRENCY }, () => worker()),
    );
  } finally {
    draining = false;
    if (runId === generation && queue.length > 0) {
      void drain(runId);
    }
  }
}

function scheduleDrain(runId: number, immediate: boolean): void {
  if (delayTimer != null) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }
  if (immediate) {
    void drain(runId);
    return;
  }
  delayTimer = setTimeout(() => {
    delayTimer = null;
    if (runId !== generation) {
      return;
    }
    void drain(runId);
  }, START_DELAY_MS);
}

/**
 * Warm a small set of display URIs. Safe to call as the map/sheet updates —
 * priority ids go to the front; queue never exceeds MAX_QUEUE.
 */
export function startMonthImageWarmup(input: MonthImageWarmupInput): void {
  const ids = uniqueIds(input.assetIds);
  if (ids.length === 0) {
    return;
  }

  const monthChanged = activeMonth !== input.month;
  if (monthChanged) {
    activeMonth = input.month;
    generation += 1;
    queue = [];
    hasStartedDelayForMonth = false;
    if (delayTimer != null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
  }

  enqueueFront(ids);
  if (queue.length === 0) {
    return;
  }

  const runId = generation;
  if (!hasStartedDelayForMonth) {
    hasStartedDelayForMonth = true;
    scheduleDrain(runId, false);
    return;
  }
  if (!draining) {
    scheduleDrain(runId, true);
  }
}

/** Test helper — not used by UI. */
export function resetMonthImageWarmupForTests(): void {
  generation += 1;
  activeMonth = null;
  queue = [];
  draining = false;
  hasStartedDelayForMonth = false;
  if (delayTimer != null) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }
  warmedAssetIds.clear();
}
