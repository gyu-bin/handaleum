import { useCallback, useEffect } from 'react';

import { setGridThumbWarmPaused } from '../services/mediaLibrary';

/**
 * FlatList scroll handlers — stop starting new thumb exports while flinging.
 */
export function usePauseGridThumbWarmOnScroll() {
  useEffect(() => {
    return () => {
      setGridThumbWarmPaused(false);
    };
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    setGridThumbWarmPaused(true);
  }, []);

  const onScrollEndDrag = useCallback(() => {
    setTimeout(() => {
      setGridThumbWarmPaused(false);
    }, 80);
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    setGridThumbWarmPaused(false);
  }, []);

  return { onScrollBeginDrag, onScrollEndDrag, onMomentumScrollEnd };
}
