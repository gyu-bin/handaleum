import { useState } from 'react';
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResumableZoom } from 'react-native-zoom-toolkit';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import type { StampMapSelection } from '../services/stampMapIndex';
import { StampKoreaMap } from './StampKoreaMap';

export interface StampMapModalProps {
  visible: boolean;
  collected: StampsCollected;
  onClose: () => void;
  onSelect: (selection: StampMapSelection) => void;
}

/** Full-screen coloring-book visit map. */
export function StampMapModal({
  visible,
  collected,
  onClose,
  onSelect,
}: StampMapModalProps) {
  const insets = useSafeAreaInsets();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const visitCount = Object.keys(collected).length;

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
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{strings.stamps.mapTitle}</Text>
              <Text style={styles.subtitle}>
                {visitCount > 0
                  ? strings.stamps.mapVisitCount(visitCount)
                  : strings.stamps.mapEmpty}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={strings.stamps.mapClose}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && styles.closePressed,
              ]}
            >
              <Text style={styles.closeLabel}>{strings.stamps.mapClose}</Text>
            </Pressable>
          </View>

          <View style={styles.mapStage} onLayout={onMapLayout}>
            {mapSize.width > 0 && mapSize.height > 0 ? (
              <ResumableZoom
                style={styles.flex}
                maxScale={6}
                pinchEnabled
                panEnabled
                tapsEnabled={false}
              >
                <View style={{ width: mapSize.width, height: mapSize.height }}>
                  <StampKoreaMap
                    collected={collected}
                    style={{
                      width: mapSize.width,
                      height: mapSize.height,
                    }}
                    onSelect={(selection) => {
                      onSelect(selection);
                      onClose();
                    }}
                  />
                </View>
              </ResumableZoom>
            ) : null}
          </View>

          <Text style={styles.hint}>{strings.stamps.mapHint}</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.type.title,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  closePressed: {
    opacity: 0.5,
  },
  closeLabel: {
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
