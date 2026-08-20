import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

import { markOtaJustApplied } from '@/lib/otaUpdateFlag';

const OTA_TIMEOUT_MS = 12_000;
/** Skip re-check if we looked this recently (rapid background/foreground). */
const MIN_CHECK_GAP_MS = 30_000;
/** While the app stays open, re-check on this interval. */
const FOREGROUND_POLL_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('ota-timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export type OtaApplyResult =
  | { kind: 'skipped' }
  | { kind: 'none' }
  | { kind: 'reloading' }
  | { kind: 'failed' };

export type OtaProgressPhase = 'checking' | 'updating';

let inflight: Promise<OtaApplyResult> | null = null;
let lastCheckAt = 0;

/**
 * Check / fetch / reload. Single-flight — concurrent callers share one run.
 * Returns `reloading` only when reloadAsync was invoked (app will restart).
 */
export async function applyOtaUpdateIfAvailable(
  onProgress?: (phase: OtaProgressPhase) => void,
  options?: { force?: boolean },
): Promise<OtaApplyResult> {
  if (__DEV__ || !Updates.isEnabled) {
    return { kind: 'skipped' };
  }

  if (inflight) {
    return inflight;
  }

  const now = Date.now();
  if (!options?.force && now - lastCheckAt < MIN_CHECK_GAP_MS) {
    return { kind: 'none' };
  }
  lastCheckAt = now;

  inflight = (async (): Promise<OtaApplyResult> => {
    try {
      onProgress?.('checking');
      const check = await withTimeout(
        Updates.checkForUpdateAsync(),
        OTA_TIMEOUT_MS,
      );
      if (!check.isAvailable) {
        return { kind: 'none' };
      }

      onProgress?.('updating');
      await withTimeout(Updates.fetchUpdateAsync(), OTA_TIMEOUT_MS);
      markOtaJustApplied();
      // Let kv-store flush before process restart (same as High-noon).
      await new Promise((r) => setTimeout(r, 80));
      await Updates.reloadAsync();
      return { kind: 'reloading' };
    } catch {
      return { kind: 'failed' };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export type StartOtaAutoApplyOptions = {
  onProgress?: (phase: OtaProgressPhase) => void;
  onSettled?: (result: OtaApplyResult) => void;
  /** When true, skip the immediate cold-start check (caller already ran it). */
  skipInitial?: boolean;
};

/**
 * Launch check + re-check when returning to foreground + poll while active.
 * Applies (reload) as soon as a new update is on the server.
 */
export function startOtaAutoApply(options: StartOtaAutoApplyOptions = {}): () => void {
  const { onProgress, onSettled, skipInitial = false } = options;
  let cancelled = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let appState: AppStateStatus = AppState.currentState;

  const run = (force: boolean) => {
    if (cancelled) {
      return;
    }
    void applyOtaUpdateIfAvailable(onProgress, { force }).then((result) => {
      if (cancelled) {
        return;
      }
      onSettled?.(result);
    });
  };

  const clearPoll = () => {
    if (pollTimer != null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPoll = () => {
    clearPoll();
    pollTimer = setInterval(() => {
      if (AppState.currentState === 'active') {
        run(false);
      }
    }, FOREGROUND_POLL_MS);
  };

  if (!skipInitial) {
    run(true);
  }
  if (appState === 'active') {
    startPoll();
  }

  const onAppState = (next: AppStateStatus) => {
    const wasActive = appState === 'active';
    appState = next;
    if (next === 'active') {
      // Returning from background — check immediately.
      run(true);
      startPoll();
    } else if (wasActive) {
      clearPoll();
    }
  };

  const sub = AppState.addEventListener('change', onAppState);

  return () => {
    cancelled = true;
    clearPoll();
    sub.remove();
  };
}
