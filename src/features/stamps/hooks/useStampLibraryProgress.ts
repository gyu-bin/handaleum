import { useSyncExternalStore } from 'react';

import {
  getStampLibraryProgress,
  subscribeStampLibraryProgress,
  type StampLibraryProgress,
} from '../services/stampBackfill';

export function useStampLibraryProgress(): StampLibraryProgress {
  return useSyncExternalStore(
    subscribeStampLibraryProgress,
    getStampLibraryProgress,
    getStampLibraryProgress,
  );
}
