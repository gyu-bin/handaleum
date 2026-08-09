import { memo, useCallback, useEffect, useMemo, type ComponentProps, type ReactElement } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Platform,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { theme } from '@/shared/constants/theme';

import { AssetThumbImage } from '../../photos/components/AssetThumbImage';
import { usePauseGridThumbWarmOnScroll } from '../../photos/hooks/usePauseGridThumbWarmOnScroll';
import { warmGridThumbs } from '../../photos/services/mediaLibrary';
import type { PhotoRef } from '../../photos/types';
import type { PlacePhotoSection } from '../../photos/utils/placeJourney';

export interface PhotoSelectGridProps {
  photos: PhotoRef[];
  /** When set, render a sectioned place grid instead of the flat list. */
  sections?: PlacePhotoSection[] | null;
  /** Place-mode resolve in flight — show a quiet spinner under the header. */
  sectionsLoading?: boolean;
  selectedAssetIds: string[];
  onToggle: (assetId: string) => void;
  /** Rendered above the grid, inside the same (virtualized) scroll container. */
  ListHeaderComponent?: ReactElement | null;
  /** Rendered below the grid, inside the same scroll container. */
  ListFooterComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** Lock scrolling while the collage drag-to-swap gesture is active. */
  scrollEnabled?: boolean;
  /** Reanimated scroll handler (e.g. sticky preview collapse). */
  onScroll?: ComponentProps<typeof Animated.FlatList>['onScroll'];
  scrollEventThrottle?: number;
}

type ListRow =
  | { kind: 'header'; key: string; title: string; count: number }
  | { kind: 'photos'; key: string; photos: PhotoRef[] };

const COLS = 3;

function chunkPhotos(photos: PhotoRef[]): PhotoRef[][] {
  const rows: PhotoRef[][] = [];
  for (let i = 0; i < photos.length; i += COLS) {
    rows.push(photos.slice(i, i + COLS));
  }
  return rows;
}

function rowsFromPhotos(photos: PhotoRef[]): ListRow[] {
  return chunkPhotos(photos).map((chunk, index) => ({
    kind: 'photos' as const,
    key: `row-${index}-${chunk[0]?.assetId ?? index}`,
    photos: chunk,
  }));
}

function rowsFromSections(sections: PlacePhotoSection[]): ListRow[] {
  const rows: ListRow[] = [];
  for (const section of sections) {
    rows.push({
      kind: 'header',
      key: `header-${section.title}`,
      title: section.title,
      count: section.data.length,
    });
    for (const [index, chunk] of chunkPhotos(section.data).entries()) {
      rows.push({
        kind: 'photos',
        key: `row-${section.title}-${index}-${chunk[0]?.assetId ?? index}`,
        photos: chunk,
      });
    }
  }
  return rows;
}

const Cell = memo(function Cell({
  photo,
  selected,
  size,
  onToggle,
}: {
  photo: PhotoRef;
  selected: boolean;
  size: number;
  onToggle: (assetId: string) => void;
}) {
  const onPress = useCallback(() => {
    onToggle(photo.assetId);
  }, [onToggle, photo.assetId]);

  const inner = Math.max(1, size - 4);

  return (
    <Pressable
      onPress={onPress}
      style={{ width: size, height: size, padding: 2 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <View style={styles.tile}>
        <AssetThumbImage assetId={photo.assetId} size={inner} />
        {selected ? (
          <>
            <View style={styles.tileRing} pointerEvents="none" />
            <View style={styles.tileRingInner} pointerEvents="none" />
            <View style={styles.checkBadge}>
              <Text style={styles.checkText}>✓</Text>
            </View>
          </>
        ) : null}
      </View>
    </Pressable>
  );
});

/**
 * Virtualized 3-up photo picker. Owns its own scroll so off-screen cells are
 * recycled — a month with hundreds of photos stays light. The screen's form
 * and save button ride along as header/footer so the whole page scrolls as one.
 *
 * Place mode packs section headers + photo rows into one FlatList (SectionList
 * has no numColumns in this RN typings).
 */
export function PhotoSelectGrid({
  photos,
  sections = null,
  sectionsLoading = false,
  selectedAssetIds,
  onToggle,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  keyboardShouldPersistTaps,
  scrollEnabled = true,
  onScroll,
  scrollEventThrottle = 16,
}: PhotoSelectGridProps) {
  const { width } = useWindowDimensions();
  const size = (width - theme.spacing.lg * 2) / COLS;
  const thumbWarmScroll = usePauseGridThumbWarmOnScroll();
  const selected = useMemo(
    () => new Set(selectedAssetIds),
    [selectedAssetIds],
  );

  const rows = useMemo(
    () => (sections != null ? rowsFromSections(sections) : rowsFromPhotos(photos)),
    [photos, sections],
  );

  useEffect(() => {
    const ids =
      sections != null
        ? sections.flatMap((s) => s.data.map((p) => p.assetId))
        : photos.map((p) => p.assetId);
    const handle = InteractionManager.runAfterInteractions(() => {
      warmGridThumbs(ids, 64);
    });
    return () => handle.cancel();
  }, [photos, sections]);

  const header = (
    <View>
      {ListHeaderComponent}
      {sectionsLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.terracotta} />
        </View>
      ) : null}
    </View>
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListRow>) => {
      if (item.kind === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionPlace}>{item.title}</Text>
              <View style={styles.sectionRule} />
              <Text style={styles.sectionCount}>{item.count}장</Text>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.photoRow}>
          {item.photos.map((photo) => (
            <Cell
              key={photo.assetId}
              photo={photo}
              selected={selected.has(photo.assetId)}
              size={size}
              onToggle={onToggle}
            />
          ))}
        </View>
      );
    },
    [onToggle, selected, size],
  );

  return (
    <Animated.FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(item) => item.key}
      extraData={selectedAssetIds}
      scrollEnabled={scrollEnabled}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={contentContainerStyle}
      initialNumToRender={8}
      maxToRenderPerBatch={4}
      windowSize={6}
      updateCellsBatchingPeriod={40}
      removeClippedSubviews={Platform.OS === 'android'}
      renderItem={renderItem}
      onScroll={onScroll}
      scrollEventThrottle={scrollEventThrottle}
      onScrollBeginDrag={thumbWarmScroll.onScrollBeginDrag}
      onMomentumScrollBegin={thumbWarmScroll.onMomentumScrollBegin}
      onScrollEndDrag={thumbWarmScroll.onScrollEndDrag}
      onMomentumScrollEnd={thumbWarmScroll.onMomentumScrollEnd}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  tile: {
    position: 'relative',
    aspectRatio: 1,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  tileRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: theme.colors.terracotta,
    borderRadius: theme.radius.sm,
  },
  tileRingInner: {
    position: 'absolute',
    top: 2,
    right: 2,
    bottom: 2,
    left: 2,
    borderWidth: 2,
    borderColor: theme.colors.labelBg,
    borderRadius: theme.radius.sm - 2,
  },
  checkBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 22,
    height: 22,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: theme.colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },

  loadingRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  sectionHeader: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionPlace: {
    ...theme.type.label,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.hairline,
  },
  sectionCount: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    fontVariant: ['tabular-nums'],
  },
  photoRow: {
    flexDirection: 'row',
  },
});
