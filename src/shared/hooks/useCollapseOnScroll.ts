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
  /** scrollY distance (px) to reach full collapse (default 160). */
  range?: number;
};

/**
 * UI-thread sticky collapse: animate wrapper height from expanded → expanded*minRatio.
 * Inner content stays at expanded height and is clipped — no React setState on scroll.
 */
export function useCollapseOnScroll(options: UseCollapseOnScrollOptions = {}) {
  const minRatio = options.minRatio ?? 0.5;
  const range = options.range ?? 160;
  const scrollY = useSharedValue(0);
  const expandedH = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
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
    setExpandedHeight,
    resetScroll,
  };
}
