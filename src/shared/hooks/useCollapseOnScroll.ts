import { useCallback } from 'react';
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { collapseHeight } from './collapseHeight';

export { collapseHeight } from './collapseHeight';

export type UseCollapseOnScrollOptions = {
  /** Collapsed height as a fraction of expanded (default 0.5). */
  minRatio?: number;
  /** scrollY distance (px) to reach full collapse (default 180). */
  range?: number;
};

/**
 * Instagram-style sticky shrink on the UI thread.
 * - `collapseStyle`: wrapper height shrinks (frees space below — not a covering sheet).
 * - `mediaScaleStyle`: content scales from the top (feels like shrinking, not clipping).
 * No React setState on scroll.
 */
export function useCollapseOnScroll(options: UseCollapseOnScrollOptions = {}) {
  const minRatio = options.minRatio ?? 0.5;
  const range = options.range ?? 180;
  const scrollY = useSharedValue(0);
  const expandedH = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
  });

  const collapseStyle = useAnimatedStyle(() => {
    const maxH = expandedH.value;
    if (maxH <= 0) {
      return { height: 0 };
    }
    return {
      height: collapseHeight(scrollY.value, maxH, range, minRatio),
    };
  });

  const mediaScaleStyle = useAnimatedStyle(() => {
    const maxH = expandedH.value;
    if (maxH <= 0) {
      return { transform: [{ scale: 1 }] };
    }
    const h = collapseHeight(scrollY.value, maxH, range, minRatio);
    const scale = h / maxH;
    return {
      transform: [{ scale }],
      // RN 0.73+ — keep the top edge pinned while scaling down.
      transformOrigin: 'top',
    };
  });

  const setExpandedHeight = useCallback(
    (height: number) => {
      if (!(height > 0)) {
        return;
      }
      if (Math.abs(expandedH.value - height) < 0.5) {
        return;
      }
      expandedH.value = height;
    },
    [expandedH],
  );

  const resetScroll = useCallback(() => {
    scrollY.value = 0;
  }, [scrollY]);

  return {
    scrollY: scrollY as SharedValue<number>,
    expandedH: expandedH as SharedValue<number>,
    onScroll,
    collapseStyle,
    mediaScaleStyle,
    setExpandedHeight,
    resetScroll,
  };
}
