import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveAssetUri } from '@/features/photos/services/mediaLibrary';
import type { PhotoRef } from '@/features/photos/types';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import {
  photosForStampLeaf,
  type StampDongPhotosQuery,
} from '../services/stampDongPhotos';

const COLS = 2;
const GAP = 8;

function Thumb({
  assetId,
  size,
}: {
  assetId: string;
  size: number;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolveAssetUri(assetId)
      .then((next) => {
        if (!cancelled) {
          setUri(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUri(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          recyclingKey={assetId}
        />
      ) : (
        <View style={[styles.thumbPlaceholder, { width: size, height: size }]} />
      )}
    </View>
  );
}

export interface StampDongPhotosModalProps {
  query: StampDongPhotosQuery | null;
  onClose: () => void;
}

/**
 * Large nearly-fullscreen sheet: photos for a visited 동/읍·면 (lookup B).
 */
export function StampDongPhotosModal({
  query,
  onClose,
}: StampDongPhotosModalProps) {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<PhotoRef[]>([]);

  const visible = query != null;
  const leaf = query?.leaf ?? '';

  useEffect(() => {
    if (!query) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPhotos([]);
    void photosForStampLeaf(query)
      .then((list) => {
        if (!cancelled) {
          setPhotos(list);
        }
      })
      .catch((error) => {
        console.warn('[stamps] dong photos failed', error);
        if (!cancelled) {
          setPhotos([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const onRequestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const pad = theme.spacing.lg;
  const cell = Math.floor((windowW - pad * 2 - GAP * (COLS - 1)) / COLS);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onRequestClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              paddingTop: Math.max(insets.top, theme.spacing.md) + 8,
              paddingBottom: Math.max(insets.bottom, theme.spacing.md),
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title} numberOfLines={1}>
            {leaf}
          </Text>
          <Text style={styles.subtitle}>
            {loading
              ? strings.stamps.dongPhotosLoading
              : strings.stamps.dongPhotosCount(photos.length)}
          </Text>

          <View style={styles.body}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.ink} />
              </View>
            ) : photos.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.empty}>{strings.stamps.dongPhotosEmpty}</Text>
              </View>
            ) : (
              <FlatList
                data={photos}
                keyExtractor={(item) => item.assetId}
                numColumns={COLS}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Thumb assetId={item.assetId} size={cell} />
                )}
              />
            )}
          </View>

          <Pressable
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel={strings.stamps.dongPhotosClose}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && styles.closePressed,
            ]}
          >
            <Text style={styles.closeText}>{strings.stamps.dongPhotosClose}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  sheet: {
    flex: 1,
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    ...theme.shadows.card,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: theme.spacing.md,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  empty: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  grid: {
    paddingBottom: theme.spacing.md,
    gap: GAP,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  thumb: {
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  closePressed: {
    opacity: 0.55,
  },
  closeText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
  },
});
