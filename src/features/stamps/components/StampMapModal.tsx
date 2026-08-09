import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
 * Visit map — empty land + pastel 동 blobs (no legend).
 */
export function StampMapModal({
  visible,
  collected,
  onClose,
}: StampMapModalProps) {
  const insets = useSafeAreaInsets();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

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

        <View style={styles.mapStage} onLayout={onMapLayout}>
          {mapSize.width > 0 && mapSize.height > 0 ? (
            <StampKoreaMap
              collected={collected}
              style={{
                width: mapSize.width,
                height: mapSize.height,
              }}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  },
});
