import type { MonthKey } from '../types';

export type MonthLoadPhase = 'idle' | 'listing' | 'gps' | 'done';

export type MonthLoadProgress = {
  month: MonthKey | null;
  phase: MonthLoadPhase;
  /** Photos with a GPS decision (located or no-location). */
  done: number;
  /** Camera-roll assets in this month. 0 while still listing. */
  total: number;
};

const IDLE: MonthLoadProgress = {
  month: null,
  phase: 'idle',
  done: 0,
  total: 0,
};

let state: MonthLoadProgress = IDLE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getMonthLoadProgress(): MonthLoadProgress {
  return state;
}

export function subscribeMonthLoadProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMonthLoadProgress(next: MonthLoadProgress): void {
  if (
    state.month === next.month &&
    state.phase === next.phase &&
    state.done === next.done &&
    state.total === next.total
  ) {
    return;
  }
  state = next;
  emit();
}

export function resetMonthLoadProgress(): void {
  if (state.phase === 'idle') {
    return;
  }
  state = IDLE;
  emit();
}
