import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGridThumbUri } from '@/features/photos/hooks/useGridThumbUri';
import type { PhotoRef } from '@/features/photos/types';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import {
  photosForStampLeaf,
  type StampDongPhotosQuery,
} from '../services/stampDongPhotos';

const COLS = 2;
const GAP = 10;
const H_PAD = theme.spacing.md;
/** Decode budget for 2-col cells — full-res ph:// thrash on scroll. */
const THUMB_SIZE = 256;

type SortMode = 'newest' | 'oldest';

type ThumbRow = {
  assetId: string;
  dateLabel: string;
};

function formatTakenAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    return '';
  }
  return new Date(t).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

const Thumb = memo(function Thumb({
  assetId,
  dateLabel,
  size,
}: {
  assetId: string;
  dateLabel: string;
  size: number;
}) {
  const [retryNonce, setRetryNonce] = useState(0);
  const [failed, setFailed] = useState(false);
  const uri = useGridThumbUri(assetId, THUMB_SIZE, retryNonce);

  useEffect(() => {
    setFailed(false);
  }, [assetId, retryNonce]);

  const onRetry = useCallback(() => {
    setFailed(false);
    setRetryNonce((n) => n + 1);
  }, []);

  return (
    <View style={{ width: size }}>
      <Pressable
        onPress={failed ? onRetry : undefined}
        disabled={!failed}
        accessibilityRole={failed ? 'button' : undefined}
        accessibilityLabel={
          failed ? strings.stamps.dongPhotoRetry : undefined
        }
        style={[styles.thumb, { width: size, height: size }]}
      >
        {uri && !failed ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size }}
            contentFit="cover"
            recyclingKey={`${assetId}-${THUMB_SIZE}`}
            cachePolicy="memory-disk"
            transition={0}
            priority="low"
            onError={() => {
              setFailed(true);
            }}
          />
        ) : null}

        {failed ? (
          <View style={styles.thumbOverlay}>
            <Text style={styles.retryLabel}>{strings.stamps.dongPhotoRetry}</Text>
          </View>
        ) : null}
      </Pressable>
      {dateLabel ? (
        <Text style={styles.takenAt} numberOfLines={1}>
          {dateLabel}
        </Text>
      ) : null}
    </View>
  );
});

export interface StampDongPhotosModalProps {
  query: StampDongPhotosQuery | null;
  onClose: () => void;
}

/**
 * Full-screen quiet sheet: photos for a visited 동/읍·면.
 */
export function StampDongPhotosModal({
  query,
  onClose,
}: StampDongPhotosModalProps) {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('newest');

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
    setSortMode('newest');
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

  const rows = useMemo((): ThumbRow[] => {
    if (photos.length === 0) {
      return [];
    }
    const ordered =
      photos.length <= 1
        ? photos
        : [...photos].sort((a, b) =>
            sortMode === 'newest'
              ? b.takenAt.localeCompare(a.takenAt)
              : a.takenAt.localeCompare(b.takenAt),
          );
    return ordered.map((p) => ({
      assetId: p.assetId,
      dateLabel: formatTakenAt(p.takenAt),
    }));
  }, [photos, sortMode]);

  const onRequestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const cell = Math.floor((windowW - H_PAD * 2 - GAP * (COLS - 1)) / COLS);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ThumbRow>) => (
      <Thumb assetId={item.assetId} dateLabel={item.dateLabel} size={cell} />
    ),
    [cell],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onRequestClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, theme.spacing.sm),
            paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title} numberOfLines={1}>
              {leaf}
            </Text>
            <Text style={styles.meta}>
              {loading
                ? strings.stamps.dongPhotosLoading
                : strings.stamps.dongPhotosCount(photos.length)}
            </Text>
          </View>
          <Pressable
            onPress={onRequestClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={strings.stamps.dongPhotosClose}
            style={({ pressed }) => [styles.closeHit, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>{strings.stamps.dongPhotosClose}</Text>
          </Pressable>
        </View>

        {!loading && photos.length > 1 ? (
          <View style={styles.sortRow}>
            <Pressable
              onPress={() => setSortMode('newest')}
              accessibilityRole="button"
              accessibilityState={{ selected: sortMode === 'newest' }}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text
                style={[
                  styles.sortText,
                  sortMode === 'newest' && styles.sortTextOn,
                ]}
              >
                {strings.stamps.dongPhotosNewest}
              </Text>
            </Pressable>
            <Text style={styles.sortDot}>·</Text>
            <Pressable
              onPress={() => setSortMode('oldest')}
              accessibilityRole="button"
              accessibilityState={{ selected: sortMode === 'oldest' }}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text
                style={[
                  styles.sortText,
                  sortMode === 'oldest' && styles.sortTextOn,
                ]}
              >
                {strings.stamps.dongPhotosOldest}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.sortSpacer} />
        )}

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
              data={rows}
              keyExtractor={(item) => item.assetId}
              numColumns={COLS}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              windowSize={7}
              updateCellsBatchingPeriod={40}
              removeClippedSubviews={false}
              renderItem={renderItem}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: H_PAD,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  meta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
  },
  closeHit: {
    paddingVertical: 2,
    paddingLeft: theme.spacing.sm,
  },
  closeLabel: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.45,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  sortSpacer: {
    height: theme.spacing.md,
  },
  sortText: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    fontWeight: '500',
  },
  sortTextOn: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  sortDot: {
    ...theme.type.micro,
    color: theme.colors.subtle,
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
    paddingBottom: theme.spacing.lg,
  },
  row: {
    gap: GAP,
    marginBottom: GAP + 4,
  },
  thumb: {
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  retryLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  takenAt: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    marginTop: 5,
    letterSpacing: 0.1,
  },
});
