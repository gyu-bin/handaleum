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
  /** Collapsed height as a fraction of expanded (default 0.55). */
  minRatio?: number;
  /** scrollY distance (px) to reach full collapse (default 160). */
  range?: number;
};

/**
 * Collapse only a sticky media slot:
 * - `collapseStyle` shrinks that slot's height (list below grows via normal flex)
 * - `mediaScaleStyle` scales media from the top so it looks proportional, not cropped
 *
 * Do NOT translate the scrolling list — that clips the bottom chrome.
 */
export function useCollapseOnScroll(options: UseCollapseOnScrollOptions = {}) {
  const minRatio = options.minRatio ?? 0.55;
  const range = options.range ?? 160;
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
    return {
      transform: [{ scale: h / maxH }],
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
