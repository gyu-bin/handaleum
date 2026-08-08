import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { theme } from '@/shared/constants/theme';

import {
  resolveAssetUri,
  syncAssetDisplayUri,
} from '../../photos/services/mediaLibrary';
import { collageRects, COLLAGE_MAX, type CollageRect } from '../utils/collageLayout';

const GUTTER = 6;
const RADIUS = 6;
const LONG_PRESS_MS = 180;
const LIFT_SCALE = 1.06;
const SPRING_LIFT = { damping: 18, stiffness: 280, mass: 0.55 };
const SPRING_MOVE = { damping: 20, stiffness: 260, mass: 0.7 };
const SPRING_SETTLE = { damping: 22, stiffness: 300, mass: 0.6 };

function useUri(assetId: string): string | null {
  const syncUri = syncAssetDisplayUri(assetId, 256);
  const [asyncUri, setAsyncUri] = useState<string | null>(null);
  useEffect(() => {
    if (syncUri) {
      return;
    }
    let cancelled = false;
    void resolveAssetUri(assetId, { imageSize: 256 })
      .then((next) => {
        if (!cancelled) {
          setAsyncUri(next);
        }
      })
      .catch((error) => {
        console.warn('CollageEditor uri failed', assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, syncUri]);
  return syncUri ?? asyncUri;
}

function EditableCell({
  assetId,
  rect,
  isDragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPress,
}: {
  assetId: string;
  rect: CollageRect;
  isDragging: boolean;
  onDragStart: (
    assetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
  onDragMove: (assetId: string, tx: number, ty: number) => void;
  onDragEnd: () => void;
  onPress?: (assetId: string) => void;
}) {
  const uri = useUri(assetId);
  const left = useSharedValue(rect.x);
  const top = useSharedValue(rect.y);
  const width = useSharedValue(rect.w);
  const height = useSharedValue(rect.h);
  const originX = useSharedValue(rect.x);
  const originY = useSharedValue(rect.y);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(1);
  const dragging = useSharedValue(false);

  // Other cells slide into the vacated slot; size also springs (cover ↔ tile).
  useEffect(() => {
    width.value = withSpring(rect.w, SPRING_MOVE);
    height.value = withSpring(rect.h, SPRING_MOVE);
    if (!isDragging) {
      left.value = withSpring(rect.x, SPRING_MOVE);
      top.value = withSpring(rect.y, SPRING_MOVE);
    }
  }, [height, isDragging, left, rect.h, rect.w, rect.x, rect.y, top, width]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_MS)
      .maxPointers(1)
      .onStart(() => {
        originX.value = left.value;
        originY.value = top.value;
        tx.value = 0;
        ty.value = 0;
        dragging.value = true;
        lift.value = withSpring(LIFT_SCALE, SPRING_LIFT);
        runOnJS(onDragStart)(
          assetId,
          originX.value,
          originY.value,
          width.value,
          height.value,
        );
      })
      .onUpdate((e) => {
        tx.value = e.translationX;
        ty.value = e.translationY;
        runOnJS(onDragMove)(assetId, e.translationX, e.translationY);
      })
      .onFinalize(() => {
        // Hand off from finger coords into layout springs.
        left.value = originX.value + tx.value;
        top.value = originY.value + ty.value;
        tx.value = 0;
        ty.value = 0;
        dragging.value = false;
        lift.value = withSpring(1, SPRING_SETTLE);
        runOnJS(onDragEnd)();
      });

    if (!onPress) {
      return pan;
    }
    const tap = Gesture.Tap().onEnd(() => {
      runOnJS(onPress)(assetId);
    });
    return Gesture.Exclusive(tap, pan);
  }, [
    assetId,
    dragging,
    height,
    left,
    lift,
    onDragEnd,
    onDragMove,
    onDragStart,
    onPress,
    originX,
    originY,
    top,
    tx,
    ty,
    width,
  ]);

  const style = useAnimatedStyle(() => {
    const active = dragging.value;
    return {
      left: active ? originX.value + tx.value : left.value,
      top: active ? originY.value + ty.value : top.value,
      width: width.value,
      height: height.value,
      transform: [{ scale: lift.value }],
      zIndex: active ? 30 : 1,
      shadowOpacity: active ? 0.24 : 0.08,
      shadowRadius: active ? 12 : 4,
      elevation: active ? 10 : 2,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.cell, { borderRadius: RADIUS }, style]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="cover"
            recyclingKey={assetId}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export interface CollageEditorProps {
  /** Selected photo asset ids, in collage order (index 0 = first cell). */
  assetIds: string[];
  /** Square editor edge length in px (back-compat; prefer width/height). */
  size?: number;
  /** Box width in px — overrides `size`. */
  width?: number;
  /** Box height in px — overrides `size`. */
  height?: number;
  /** Swap two positions (updates the parent's order). Called live while dragging. */
  onSwap: (a: number, b: number) => void;
  /** Parent locks its scroll while a cell is being dragged. */
  onDraggingChange?: (dragging: boolean) => void;
  /** Short tap on a cell (e.g. remove from selection on create). */
  onPressCell?: (assetId: string) => void;
}

/**
 * Interactive collage: long-press a photo and drag — other photos slide into
 * the empty slot as you hover their cells. Release to settle.
 */
export function CollageEditor({
  assetIds,
  size,
  width,
  height,
  onSwap,
  onDraggingChange,
  onPressCell,
}: CollageEditorProps) {
  const w = width ?? size ?? 0;
  const h = height ?? size ?? 0;
  const shown = assetIds.slice(0, COLLAGE_MAX);
  const rects = useMemo(
    () => collageRects(shown.length, w, h, GUTTER),
    [shown.length, w, h],
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOriginRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  // Avoid swap thrash when the finger sits on a cell boundary.
  const lastHoverRef = useRef(-1);
  const shownRef = useRef(shown);
  const rectsRef = useRef(rects);
  shownRef.current = shown;
  rectsRef.current = rects;

  const handleDragStart = useCallback(
    (id: string, x: number, y: number, cw: number, ch: number) => {
      dragOriginRef.current = { x, y, w: cw, h: ch };
      lastHoverRef.current = shownRef.current.indexOf(id);
      setDraggingId(id);
      onDraggingChange?.(true);
    },
    [onDraggingChange],
  );

  const handleDragMove = useCallback(
    (id: string, tX: number, tY: number) => {
      const origin = dragOriginRef.current;
      const order = shownRef.current;
      const from = order.indexOf(id);
      if (from < 0) {
        return;
      }
      const cx = origin.x + origin.w / 2 + tX;
      const cy = origin.y + origin.h / 2 + tY;
      const hover = rectsRef.current.findIndex(
        (r) =>
          cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h,
      );
      if (hover < 0 || hover === from || hover === lastHoverRef.current) {
        return;
      }
      lastHoverRef.current = hover;
      onSwap(from, hover);
    },
    [onSwap],
  );

  const handleDragEnd = useCallback(() => {
    lastHoverRef.current = -1;
    setDraggingId(null);
    onDraggingChange?.(false);
  }, [onDraggingChange]);

  return (
    <View style={{ width: w, height: h }} collapsable={false}>
      {shown.map((id, i) => (
        <EditableCell
          // Photo identity: gesture stays on the same image while others slide.
          key={id}
          assetId={id}
          rect={rects[i]!}
          isDragging={draggingId === id}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onPress={onPressCell}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    opacity: 0.5,
  },
});
