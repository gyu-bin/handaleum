import { Image } from 'expo-image';

import type { MonthKey } from '../types';
import {
  isGridThumbWarmPaused,
  resolveAssetFileUri,
  resolveAssetUri,
  waitWhilePinExportBusy,
} from './mediaLibrary';
import {
  DEFAULT_MONTH_FILL_MAX,
  planMonthPrewarmIds,
} from './monthPrewarmPlan';

export { planMonthPrewarmIds } from './monthPrewarmPlan';

/**
 * Budgeted month thumb prewarm (middle path):
 * GPS indexing stays metadata-only; after a month loads we idle-bake small
 * file:// pin thumbs for map seeds first, then the rest of that month (capped).
 *
 * NEVER enqueue the whole library. Other months warm when opened.
 */

const WARM_CONCURRENCY = 2;
/** After held bike (~1.5s) + first paint — avoid fighting LoadingView spin. */
const START_DELAY_MS = 2000;
/** Priority (seeds/covers) + month fill headroom. */
const MAX_QUEUE = 200;
const warmedAssetIds = new Set<string>();

let activeMonth: MonthKey | null = null;
let generation = 0;
let queue: string[] = [];
let draining = false;
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let hasStartedDelayForMonth = false;

export interface MonthImageWarmupInput {
  month: MonthKey;
  /** Only these assets — do not pass the full library. */
  assetIds: string[];
}

export interface MonthThumbPrewarmInput {
  month: MonthKey;
  /** Map pin seeds + covers — always front of the queue. */
  priorityIds: string[];
  /** Same-month GPS photos; fill is capped. */
  monthAssetIds: string[];
  maxMonthFill?: number;
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

function enqueueBack(ids: string[]): void {
  const inQueue = new Set(queue);
  for (const id of ids) {
    if (warmedAssetIds.has(id) || inQueue.has(id)) {
      continue;
    }
    queue.push(id);
    inQueue.add(id);
  }
  trimQueue();
}

async function yieldIfBusy(runId: number): Promise<boolean> {
  // true = aborted (generation changed)
  while (isGridThumbWarmPaused()) {
    if (runId !== generation) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 220));
  }
  if (runId !== generation) {
    return true;
  }
  await waitWhilePinExportBusy(800);
  return runId !== generation;
}

async function warmOne(assetId: string): Promise<void> {
  if (warmedAssetIds.has(assetId)) {
    return;
  }
  try {
    // Naver pins need durable file:// thumbs — display prefetch alone is not enough.
    await resolveAssetFileUri(assetId);
    const uri = await resolveAssetUri(assetId);
    if (uri) {
      await Image.prefetch(uri, 'memory-disk');
    }
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
        if (await yieldIfBusy(runId)) {
          // Put it back — scroll/export took priority.
          queue.unshift(assetId);
          return;
        }
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
      // Reschedule gently if we yielded for scroll.
      scheduleDrain(runId, false);
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

function ensureMonth(month: MonthKey): number {
  const monthChanged = activeMonth !== month;
  if (monthChanged) {
    activeMonth = month;
    generation += 1;
    queue = [];
    hasStartedDelayForMonth = false;
    if (delayTimer != null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
  }
  return generation;
}

function kickDrain(runId: number): void {
  if (queue.length === 0) {
    return;
  }
  if (!hasStartedDelayForMonth) {
    hasStartedDelayForMonth = true;
    scheduleDrain(runId, false);
    return;
  }
  if (!draining) {
    scheduleDrain(runId, true);
  }
}

/**
 * Warm a small set of display URIs. Priority ids go to the front.
 */
export function startMonthImageWarmup(input: MonthImageWarmupInput): void {
  const ids = uniqueIds(input.assetIds);
  if (ids.length === 0) {
    return;
  }
  const runId = ensureMonth(input.month);
  enqueueFront(ids);
  kickDrain(runId);
}

/**
 * Middle-path prewarm: pin seeds/covers first, then capped same-month fill.
 * Call after month GPS has settled (`!isFetching`).
 */
export function startMonthThumbPrewarm(input: MonthThumbPrewarmInput): void {
  const { priority, fill } = planMonthPrewarmIds(
    input.priorityIds,
    input.monthAssetIds,
    input.maxMonthFill ?? DEFAULT_MONTH_FILL_MAX,
  );

  if (priority.length === 0 && fill.length === 0) {
    return;
  }

  const runId = ensureMonth(input.month);
  enqueueFront(priority);
  enqueueBack(fill);
  kickDrain(runId);
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
