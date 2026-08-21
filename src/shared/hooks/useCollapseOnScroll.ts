import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  COLLAPSE_SNAP_MS,
  collapseHeight,
  collapsePanSnapTarget,
  collapseScrollSnapTarget,
  collapseTravel,
} from './collapseHeight';

export { collapseHeight, collapseTravel } from './collapseHeight';

export type UseCollapseOnScrollOptions = {
  /** Collapsed height as a fraction of expanded (default 0.55). */
  minRatio?: number;
  /** scrollY distance (px) to reach full collapse (default 160). */
  range?: number;
  /** Ignore down-scroll until past this offset (px). Default 0. */
  deadzone?: number;
  /**
   * Instagram-style latch: hide fully on down-scroll, stay hidden while
   * the grid scrolls, snap on finger-up, expand only by pulling the header.
   */
  latch?: boolean;
};

/**
 * Collapse only a sticky media slot:
 * - `collapseStyle` shrinks that slot's height (list below grows via normal flex)
 * - `mediaScaleStyle` scales media from the top so it looks proportional, not cropped
 * - default: down-scroll collapses, up-scroll expands (does not wait for y === 0)
 * - `latch`: grid scroll never expands; pull the sheet header down to show
 *
 * Do NOT translate the scrolling list — that clips the bottom chrome.
 */
export function useCollapseOnScroll(options: UseCollapseOnScrollOptions = {}) {
  const minRatio = options.minRatio ?? 0.55;
  const range = options.range ?? 160;
  const deadzone = options.deadzone ?? 0;
  const latch = options.latch ?? false;
  const scrollY = useSharedValue(0);
  const collapseY = useSharedValue(0);
  const expandedH = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = Math.max(0, event.contentOffset.y);
      const viewH = event.layoutMeasurement.height;
      const contentH = event.contentSize.height;
      const maxScroll =
        viewH > 0 ? Math.max(0, contentH - viewH) : Number.MAX_SAFE_INTEGER;
      const dy = y - scrollY.value;
      scrollY.value = y;
      cancelAnimation(collapseY);
      collapseY.value = collapseTravel(
        collapseY.value,
        y,
        dy,
        range,
        maxScroll,
        deadzone,
        latch,
      );
    },
    onEndDrag: (event) => {
      if (!latch) {
        return;
      }
      const y = Math.max(0, event.contentOffset.y);
      collapseY.value = withTiming(
        collapseScrollSnapTarget(y, range, deadzone, collapseY.value),
        { duration: COLLAPSE_SNAP_MS },
      );
    },
    onMomentumEnd: (event) => {
      if (!latch) {
        return;
      }
      const y = Math.max(0, event.contentOffset.y);
      collapseY.value = withTiming(
        collapseScrollSnapTarget(y, range, deadzone, collapseY.value),
        { duration: COLLAPSE_SNAP_MS },
      );
    },
  });

  const collapseStyle = useAnimatedStyle(() => {
    const maxH = expandedH.value;
    if (maxH <= 0) {
      return { height: 0 };
    }
    return {
      height: collapseHeight(collapseY.value, maxH, range, minRatio),
    };
  });

  const mediaScaleStyle = useAnimatedStyle(() => {
    const maxH = expandedH.value;
    if (maxH <= 0) {
      return { transform: [{ scale: 1 }] };
    }
    const h = collapseHeight(collapseY.value, maxH, range, minRatio);
    return {
      transform: [{ scale: h / maxH }],
      transformOrigin: 'top',
    };
  });

  const previewPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(latch)
        .activeOffsetY([-12, 12])
        .failOffsetX([-24, 24])
        .onBegin(() => {
          cancelAnimation(collapseY);
          panStartY.value = collapseY.value;
        })
        .onUpdate((event) => {
          collapseY.value = Math.min(
            range,
            Math.max(0, panStartY.value - event.translationY),
          );
        })
        .onEnd((event) => {
          collapseY.value = withTiming(
            collapsePanSnapTarget(collapseY.value, event.velocityY, range),
            { duration: COLLAPSE_SNAP_MS },
          );
        }),
    [collapseY, latch, panStartY, range],
  );

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
    collapseY.value = 0;
  }, [collapseY, scrollY]);

  return {
    scrollY: scrollY as SharedValue<number>,
    expandedH: expandedH as SharedValue<number>,
    onScroll,
    collapseStyle,
    mediaScaleStyle,
    previewPan,
    setExpandedHeight,
    resetScroll,
  };
}
