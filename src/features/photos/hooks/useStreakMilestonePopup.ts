import { useCallback, useSyncExternalStore } from 'react';

import {
  dismissStreakMilestonePopup,
  peekStreakMilestonePopup,
  subscribePhotoStreak,
} from '../services/photoStreakStore';

export function useStreakMilestonePopup(): {
  days: number;
  dismiss: () => void;
} {
  const days = useSyncExternalStore(
    subscribePhotoStreak,
    peekStreakMilestonePopup,
    peekStreakMilestonePopup,
  );
  const dismiss = useCallback(() => {
    dismissStreakMilestonePopup();
  }, []);
  return { days, dismiss };
}
