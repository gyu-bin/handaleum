import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import { collageRects, type CollageRect } from '../utils/collageLayout';

const GUTTER = 6;
const RADIUS = 6;

function useUri(assetId: string): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolveAssetUri(assetId).then((next) => {
      if (!cancelled) {
        setUri(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);
  return uri;
}

function EditableCell({
  assetId,
  index,
  rect,
  dragIndex,
  dx,
  dy,
  onDrop,
}: {
  assetId: string;
  index: number;
  rect: CollageRect;
  dragIndex: SharedValue<number>;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  onDrop: (index: number, tx: number, ty: number) => void;
}) {
  const uri = useUri(assetId);

  const pan = Gesture.Pan()
    .activateAfterLongPress(140)
    .onStart(() => {
      dragIndex.value = index;
    })
    .onUpdate((e) => {
      dx.value = e.translationX;
      dy.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(onDrop)(index, e.translationX, e.translationY);
      dragIndex.value = -1;
      dx.value = 0;
      dy.value = 0;
    });

  const style = useAnimatedStyle(() => {
    const active = dragIndex.value === index;
    return {
      transform: [
        { translateX: active ? dx.value : 0 },
        { translateY: active ? dy.value : 0 },
        { scale: active ? 1.06 : 1 },
      ],
      zIndex: active ? 20 : 1,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.cell,
          { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: RADIUS },
          style,
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="cover" />
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
  /** Square editor edge length in px. */
  size: number;
  /** Swap two positions (updates the parent's order). */
  onSwap: (a: number, b: number) => void;
}

/**
 * Interactive 인생네컷 collage: long-press then drag a photo onto another cell to
 * swap their positions. The order it produces is what CardTemplateStory renders.
 */
export function CollageEditor({ assetIds, size, onSwap }: CollageEditorProps) {
  const shown = assetIds.slice(0, 4);
  const rects = collageRects(shown.length, size, size, GUTTER);
  const dragIndex = useSharedValue(-1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);

  const handleDrop = useCallback(
    (index: number, tx: number, ty: number) => {
      const c = rects[index];
      if (!c) {
        return;
      }
      const px = c.x + c.w / 2 + tx;
      const py = c.y + c.h / 2 + ty;
      const target = rects.findIndex(
        (r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h,
      );
      if (target >= 0 && target !== index) {
        onSwap(index, target);
      }
    },
    [rects, onSwap],
  );

  return (
    <View style={{ width: size, height: size }}>
      {shown.map((id, i) => (
        <EditableCell
          key={id}
          assetId={id}
          index={i}
          rect={rects[i]!}
          dragIndex={dragIndex}
          dx={dx}
          dy={dy}
          onDrop={handleDrop}
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
    ...theme.shadows.card,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    opacity: 0.5,
  },
});
