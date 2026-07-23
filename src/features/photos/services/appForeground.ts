import { AppState, type AppStateStatus } from 'react-native';

/**
 * Shared foreground flag for photo GPS work. When the app backgrounds we pause
 * between batches; progress already written to assetLoc kv survives for resume.
 */
let foreground = AppState.currentState === 'active';

const listeners = new Set<(active: boolean) => void>();

function setForeground(next: boolean): void {
  if (foreground === next) {
    return;
  }
  foreground = next;
  for (const listener of listeners) {
    listener(foreground);
  }
}

AppState.addEventListener('change', (state: AppStateStatus) => {
  setForeground(state === 'active');
});

export function isAppForeground(): boolean {
  return foreground;
}

export function subscribeAppForeground(listener: (active: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Resolves when the app is foregrounded again (or immediately if already). */
export function waitForAppForeground(): Promise<void> {
  if (foreground) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsubscribe = subscribeAppForeground((active) => {
      if (active) {
        unsubscribe();
        resolve();
      }
    });
  });
}
