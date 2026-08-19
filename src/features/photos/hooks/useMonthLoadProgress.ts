import { useSyncExternalStore } from 'react';

import {
  getMonthLoadProgress,
  subscribeMonthLoadProgress,
} from '../services/monthLoadProgress';

/** Live GPS-load bar for the month currently filling `useMonthlyPhotos`. */
export function useMonthLoadProgress() {
  return useSyncExternalStore(
    subscribeMonthLoadProgress,
    getMonthLoadProgress,
    getMonthLoadProgress,
  );
}
