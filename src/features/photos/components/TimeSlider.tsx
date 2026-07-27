import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

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

/** Keep the thumb fluid; don't re-cluster the map on every touch sample. */
const EMIT_INTERVAL_MS = 80;

/**
 * Single-thumb slider controlling the upper bound (`to`).
 * `from` stays at the month start (bounds.from).
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
  const lastEmitAtRef = useRef(0);

  const emit = (nextRatio: number, force: boolean) => {
    const now = performance.now();
    if (!force && now - lastEmitAtRef.current < EMIT_INTERVAL_MS) {
      return;
    }
    lastEmitAtRef.current = now;
    onChangeRef.current({
      from: boundsFromRef.current,
      to: new Date(startMsRef.current + nextRatio * spanRef.current).toISOString(),
    });
  };

  const setFromX = (x: number, forceEmit: boolean) => {
    const width = trackWidthRef.current;
    if (width <= 0) {
      return;
    }
    const next = clamp01(x / width);
    setDragRatio(next);
    emit(next, forceEmit);
  };

  const endDrag = (x: number) => {
    setFromX(x, true);
    setDragRatio(null);
  };

  const cancelDrag = () => {
    setDragRatio(null);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .hitSlop({ top: 16, bottom: 16 })
        .onBegin((e) => {
          runOnJS(setFromX)(e.x, false);
        })
        .onUpdate((e) => {
          runOnJS(setFromX)(e.x, false);
        })
        .onEnd((e) => {
          runOnJS(endDrag)(e.x);
        })
        .onFinalize((_e, success) => {
          if (!success) {
            runOnJS(cancelDrag)();
          }
        }),
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
            setTrackWidth(Math.max(0, e.nativeEvent.layout.width));
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
    height: 36,
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
    backgroundColor: theme.colors.accent,
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
    borderColor: theme.colors.accent,
    top: 7,
    ...theme.shadows.card,
  },
});
