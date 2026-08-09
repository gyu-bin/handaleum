import { useCallback, useEffect, useRef } from 'react';

import { setGridThumbWarmPaused } from '../services/mediaLibrary';

/** Wait until fling fully settles before resuming manipulator work. */
const RESUME_MS = 220;

/**
 * FlatList scroll handlers — stop thumb exports while dragging/flinging.
 * Resume only after momentum ends (not on end-drag — that fights the fling).
 */
export function usePauseGridThumbWarmOnScroll() {
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResume = useCallback(() => {
    if (resumeTimerRef.current != null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    clearResume();
    setGridThumbWarmPaused(true);
  }, [clearResume]);

  const scheduleResume = useCallback(() => {
    clearResume();
    resumeTimerRef.current = setTimeout(() => {
      resumeTimerRef.current = null;
      setGridThumbWarmPaused(false);
    }, RESUME_MS);
  }, [clearResume]);

  useEffect(() => {
    return () => {
      clearResume();
      setGridThumbWarmPaused(false);
    };
  }, [clearResume]);

  return {
    onScrollBeginDrag: pause,
    onMomentumScrollBegin: pause,
    onScrollEndDrag: scheduleResume,
    onMomentumScrollEnd: scheduleResume,
  };
}
