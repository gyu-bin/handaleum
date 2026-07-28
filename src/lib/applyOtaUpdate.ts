import * as Updates from 'expo-updates';

import { markOtaJustApplied } from '@/lib/otaUpdateFlag';

const OTA_TIMEOUT_MS = 12_000;

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

/**
 * Check / fetch / reload while splash is up.
 * Returns `reloading` only when reloadAsync was invoked (app will restart).
 */
export async function applyOtaUpdateIfAvailable(
  onProgress?: (phase: 'checking' | 'updating') => void,
): Promise<OtaApplyResult> {
  if (__DEV__ || !Updates.isEnabled) {
    return { kind: 'skipped' };
  }

  try {
    onProgress?.('checking');
    const check = await withTimeout(Updates.checkForUpdateAsync(), OTA_TIMEOUT_MS);
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
  }
}
