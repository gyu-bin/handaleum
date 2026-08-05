import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

export interface TimeRange {
  /** ISO datetime */
  from: string;
  /** ISO datetime */
  to: string;
}

export interface TimeSliderProps {
  /** Full bounds of the month being viewed */
  bounds: TimeRange;
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Single-thumb slider controlling the upper bound (`to`).
 * `from` stays at the month start (bounds.from).
 *
 * Visual thumb updates live while dragging; parent `onChange` (map recluster)
 * fires only on gesture end — mid-drag emits were the main slider jank source.
 *
 * Uses `onStart` (gesture ACTIVE), not `onBegin` — Begin can fire then fail on
 * the first touch, which looked like “slide once, nothing happens”.
 */
export function TimeSlider({ bounds, value, onChange }: TimeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  /** Live thumb position while dragging; null when the parent value governs. */
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  const startMs = Date.parse(bounds.from);
  const endMs = Date.parse(bounds.to);
  const span = Math.max(1, endMs - startMs);
  const valueRatio = clamp01((Date.parse(value.to) - startMs) / span);
  const ratio = dragRatio ?? valueRatio;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const boundsFromRef = useRef(bounds.from);
  boundsFromRef.current = bounds.from;
  const startMsRef = useRef(startMs);
  startMsRef.current = startMs;
  const spanRef = useRef(span);
  spanRef.current = span;
  const trackWidthRef = useRef(trackWidth);
  trackWidthRef.current = trackWidth;
  const draggingRef = useRef(false);

  const commit = (nextRatio: number) => {
    onChangeRef.current({
      from: boundsFromRef.current,
      to: new Date(startMsRef.current + nextRatio * spanRef.current).toISOString(),
    });
  };

  const ratioFromX = (x: number): number | null => {
    const width = trackWidthRef.current;
    if (width <= 0) {
      return null;
    }
    return clamp01(x / width);
  };

  const endDrag = (x: number) => {
    draggingRef.current = false;
    const next = ratioFromX(x);
    if (next != null) {
      setDragRatio(next);
      commit(next);
    }
    setDragRatio(null);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // JS thread: setState + parent onChange without UI↔JS bridging quirks.
        .runOnJS(true)
        .minDistance(0)
        .hitSlop({ top: 20, bottom: 20, left: 8, right: 8 })
        .shouldCancelWhenOutside(false)
        .onStart((e) => {
          draggingRef.current = true;
          const next = ratioFromX(e.x);
          if (next != null) {
            setDragRatio(next);
          }
        })
        .onUpdate((e) => {
          if (!draggingRef.current) {
            draggingRef.current = true;
          }
          const next = ratioFromX(e.x);
          if (next != null) {
            setDragRatio(next);
          }
        })
        .onEnd((e) => {
          endDrag(e.x);
        })
        .onFinalize(() => {
          draggingRef.current = false;
          setDragRatio(null);
        }),
    // Intentionally stable — handlers read latest values via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gesture identity must stay stable
    [],
  );

  const label = new Date(startMs + ratio * span).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{strings.map.timeFilter}</Text>
        <Text style={styles.labelValue}>{label}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={(e) => {
            const w = Math.max(0, e.nativeEvent.layout.width);
            trackWidthRef.current = w;
            setTrackWidth(w);
          }}
          accessibilityRole="adjustable"
          accessibilityLabel={strings.map.timeFilter}
          accessibilityValue={{ text: label }}
        >
          <View style={styles.trackBg} pointerEvents="none" />
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} pointerEvents="none" />
          <View style={[styles.thumb, { left: `${ratio * 100}%` }]} pointerEvents="none" />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 2,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
  labelValue: {
    ...theme.type.label,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  track: {
    height: 44,
    justifyContent: 'center',
  },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceAlt,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: theme.colors.ink,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    marginLeft: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.ink,
    top: 11,
    ...theme.shadows.card,
  },
});
