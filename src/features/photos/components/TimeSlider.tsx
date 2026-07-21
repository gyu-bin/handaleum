import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
 */
/**
 * Cap on how often a drag pushes a new range to the parent. The thumb tracks
 * the finger via local state every frame regardless; this only rate-limits the
 * downstream cost (re-filter + re-cluster) so a big month can't stutter the
 * drag. The exact release value is always emitted, so the final set is correct.
 */
const EMIT_THROTTLE_MS = 110;

export function TimeSlider({ bounds, value, onChange }: TimeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(1);
  /** Live thumb position while dragging; null when the parent value governs. */
  const [dragRatio, setDragRatio] = useState<number | null>(null);
  /** Timestamp (ms) of the last range pushed to the parent, for throttling. */
  const lastEmitRef = useRef(0);
  const startMs = Date.parse(bounds.from);
  const endMs = Date.parse(bounds.to);
  const span = Math.max(1, endMs - startMs);
  const valueRatio = clamp01((Date.parse(value.to) - startMs) / span);
  const ratio = dragRatio ?? valueRatio;

  const ratioFromX = (locationX: number) => clamp01(locationX / trackWidth);

  const emit = (nextRatio: number) => {
    onChange({
      from: bounds.from,
      to: new Date(startMs + nextRatio * span).toISOString(),
    });
  };

  /**
   * Drag: move the thumb every frame (local state), but throttle the parent
   * emit so re-filtering/re-clustering can't drop frames on a large month.
   */
  const drag = (locationX: number) => {
    const next = ratioFromX(locationX);
    setDragRatio(next);
    const now = Date.now();
    if (now - lastEmitRef.current >= EMIT_THROTTLE_MS) {
      lastEmitRef.current = now;
      emit(next);
    }
  };

  const release = (locationX: number) => {
    lastEmitRef.current = 0;
    emit(ratioFromX(locationX));
    setDragRatio(null);
  };

  // Follows the thumb, not the parent value, so it can't lag mid-drag.
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
      <View
        style={styles.track}
        onLayout={(e) => {
          setTrackWidth(Math.max(1, e.nativeEvent.layout.width));
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Keep the gesture once it starts — the map's pan/pinch sits behind.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => drag(e.nativeEvent.locationX)}
        onResponderMove={(e) => drag(e.nativeEvent.locationX)}
        onResponderRelease={(e) => release(e.nativeEvent.locationX)}
        onResponderTerminate={() => setDragRatio(null)}
      >
        {/* pointerEvents none keeps the track itself the touch target, so
            locationX stays track-relative instead of flipping to a child. */}
        <View style={styles.trackBg} pointerEvents="none" />
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} pointerEvents="none" />
        <View style={[styles.thumb, { left: `${ratio * 100}%` }]} pointerEvents="none" />
      </View>
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
    height: 28,
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
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    top: 4,
    ...theme.shadows.card,
  },
});
