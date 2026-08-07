import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import {
  countVisitedDongsInSido,
  countVisitedL1InSido,
  visitedSidoNames,
  type StampMapSelection,
} from '../services/stampMapIndex';
import {
  StampKoreaMap,
  type StampKoreaMapHandle,
} from './StampKoreaMap';

export interface StampMapModalProps {
  visible: boolean;
  collected: StampsCollected;
  onClose: () => void;
  onSelect: (selection: StampMapSelection) => void;
}

/** Full-screen visit map: nation 시·도 → L1 close-up (real Korea geo). */
export function StampMapModal({
  visible,
  collected,
  onClose,
  onSelect,
}: StampMapModalProps) {
  const insets = useSafeAreaInsets();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [focusSido, setFocusSido] = useState<string | null>(null);
  const mapRef = useRef<StampKoreaMapHandle>(null);

  const visitCount = Object.keys(collected).length;
  const sidoCount = useMemo(
    () => visitedSidoNames(collected).size,
    [collected],
  );

  useEffect(() => {
    if (!visible) {
      setFocusSido(null);
    }
  }, [visible]);

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

  const subtitle = useMemo(() => {
    if (visitCount === 0) {
      return strings.stamps.mapEmpty;
    }
    if (focusSido) {
      const dongs = countVisitedDongsInSido(collected, focusSido);
      const l1 = countVisitedL1InSido(collected, focusSido);
      return strings.stamps.mapVisitCountSido(focusSido, dongs, l1);
    }
    return strings.stamps.mapVisitCount(visitCount, sidoCount);
  }, [collected, focusSido, sidoCount, visitCount]);

  const handleClose = () => {
    setFocusSido(null);
    onClose();
  };

  const handleMapSelect = (selection: StampMapSelection) => {
    if (!focusSido) {
      setFocusSido(selection.sido);
      return;
    }
    onSelect(selection);
    handleClose();
  };

  const onMapPress = (locationX: number, locationY: number) => {
    const selection = mapRef.current?.hitTest(locationX, locationY);
    if (selection) {
      handleMapSelect(selection);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        if (focusSido) {
          setFocusSido(null);
          return;
        }
        handleClose();
      }}
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
        <View style={styles.header}>
          {focusSido ? (
            <Pressable
              onPress={() => setFocusSido(null)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={strings.stamps.mapBackNation}
              style={({ pressed }) => [
                styles.sideBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sideLabel}>
                {strings.stamps.mapBackNation}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.sideSpacer} />
          )}

          <View style={styles.headerCopy}>
            <Text style={styles.title}>
              {focusSido ?? strings.stamps.mapTitle}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={strings.stamps.mapClose}
            style={({ pressed }) => [
              styles.sideBtn,
              styles.sideBtnEnd,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sideLabel}>{strings.stamps.mapClose}</Text>
          </Pressable>
        </View>

        <View style={styles.mapStage} onLayout={onMapLayout}>
          {mapSize.width > 0 && mapSize.height > 0 ? (
            <Pressable
              style={styles.flex}
              onPress={(e) => {
                onMapPress(
                  e.nativeEvent.locationX,
                  e.nativeEvent.locationY,
                );
              }}
              accessibilityRole="image"
              accessibilityLabel={
                focusSido
                  ? strings.stamps.mapA11ySido(focusSido)
                  : strings.stamps.mapA11y
              }
            >
              <StampKoreaMap
                ref={mapRef}
                collected={collected}
                mode={focusSido ? 'sido' : 'nation'}
                focusSido={focusSido ?? undefined}
                style={{
                  width: mapSize.width,
                  height: mapSize.height,
                }}
              />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.hint}>
          {focusSido ? strings.stamps.mapHintSido : strings.stamps.mapHint}
        </Text>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
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
  sideLabel: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  mapStage: {
    flex: 1,
  },
  hint: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    textAlign: 'center',
    paddingTop: theme.spacing.sm,
  },
});
