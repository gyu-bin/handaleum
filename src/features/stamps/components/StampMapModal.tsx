import { useEffect, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PaperGrain } from '@/shared/components/PaperGrain';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import { visitedSidoNames } from '../services/stampMapIndex';
import { StampKoreaMap } from './StampKoreaMap';

export interface StampMapModalProps {
  visible: boolean;
  collected: StampsCollected;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function CloseXMark({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Visit map — empty land + pastel 동 blobs.
 * Pinch to zoom, pan while zoomed; resets when the modal closes.
 */
export function StampMapModal({
  visible,
  collected,
  onClose,
}: StampMapModalProps) {
  const insets = useSafeAreaInsets();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      return;
    }
    scale.value = 1;
    tx.value = 0;
    ty.value = 0;
    startScale.value = 1;
    startTx.value = 0;
    startTy.value = 0;
  }, [scale, startScale, startTx, startTy, tx, ty, visible]);

  const visitCount = Object.keys(collected).length;
  const sidoCount = useMemo(
    () => visitedSidoNames(collected).size,
    [collected],
  );

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (
      Math.abs(width - mapSize.width) < 1 &&
      Math.abs(height - mapSize.height) < 1
    ) {
      return;
    }
    setMapSize({ width, height });
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, startScale.value * e.scale),
      );
      scale.value = next;
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        startTx.value = 0;
        startTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onBegin(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      if (scale.value <= 1.02) {
        return;
      }
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const mapTransformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const subtitle =
    visitCount === 0
      ? strings.stamps.mapEmpty
      : strings.stamps.mapVisitCount(visitCount, sidoCount);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.flex}>
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, theme.spacing.sm),
            paddingBottom: Math.max(insets.bottom, theme.spacing.md),
          },
        ]}
      >
        <PaperGrain style={styles.grain} />
        <View style={styles.header}>
          <View style={styles.sideSpacer} />
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{strings.stamps.mapTitle}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Text style={styles.hint}>{strings.stamps.mapPinchHint}</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={strings.stamps.mapClose}
            style={({ pressed }) => [
              styles.sideBtn,
              styles.sideBtnEnd,
              pressed && styles.pressed,
            ]}
          >
            <CloseXMark color={theme.colors.ink} />
          </Pressable>
        </View>

        <GestureDetector gesture={gesture}>
          <Animated.View style={styles.mapStage} onLayout={onMapLayout}>
            {mapSize.width > 0 && mapSize.height > 0 ? (
              <Animated.View style={[{ flex: 1 }, mapTransformStyle]}>
                <StampKoreaMap
                  collected={collected}
                  style={{
                    width: mapSize.width,
                    height: mapSize.height,
                  }}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
    zIndex: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    alignItems: 'center',
  },
  title: {
    ...theme.type.title,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  hint: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    textAlign: 'center',
    marginTop: 2,
  },
  sideBtn: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  sideBtnEnd: {
    alignItems: 'flex-end',
  },
  sideSpacer: {
    minWidth: 52,
  },
  pressed: {
    opacity: 0.5,
  },
  mapStage: {
    flex: 1,
    zIndex: 1,
    overflow: 'hidden',
  },
});
