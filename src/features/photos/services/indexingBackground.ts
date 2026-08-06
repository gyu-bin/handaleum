import { AppState, type AppStateStatus } from 'react-native';
import {
  beginBackgroundWork,
  endBackgroundWork,
} from 'asset-locations';

/**
 * Keep stamp/library indexing alive across lock / app switch for as long as
 * the OS allows (iOS UIBackgroundTask). Not a forever background service —
 * when the OS expires the task, work pauses and resume-on-foreground picks up.
 */

let holdCount = 0;
let appStateSub: { remove: () => void } | null = null;

function ensureAppStateHook(): void {
  if (appStateSub) {
    return;
  }
  appStateSub = AppState.addEventListener('change', onAppState);
}

function tearDownAppStateHook(): void {
  if (holdCount > 0) {
    return;
  }
  appStateSub?.remove();
  appStateSub = null;
}

function onAppState(state: AppStateStatus): void {
  if (holdCount <= 0) {
    return;
  }
  // Re-assert the task when leaving the foreground — a previous task may have
  // already expired while we were active.
  if (state === 'background' || state === 'inactive') {
    beginBackgroundWork('handaleum-indexing');
  }
}

/** Call when full-album stamp sync (or similar) starts. */
export function retainIndexingBackground(): void {
  holdCount += 1;
  ensureAppStateHook();
  beginBackgroundWork('handaleum-indexing');
}

/** Call in sync finally — paired with retainIndexingBackground. */
export function releaseIndexingBackground(): void {
  holdCount = Math.max(0, holdCount - 1);
  if (holdCount === 0) {
    endBackgroundWork();
    tearDownAppStateHook();
  }
}
