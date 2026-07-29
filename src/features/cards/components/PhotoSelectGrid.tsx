import { memo, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../../photos/services/mediaLibrary';
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
}

type ListRow =
  | { kind: 'header'; key: string; title: string }
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
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveAssetUri(photo.assetId)
      .then((next) => {
        if (!cancelled) {
          setUri(next);
        }
      })
      .catch((error) => {
        console.warn('PhotoSelectGrid uri failed', photo.assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.assetId]);

  return (
    <Pressable
      onPress={() => onToggle(photo.assetId)}
      style={{ width: size, height: size, padding: 2 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          recyclingKey={photo.assetId}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}
      {selected ? (
        <View style={styles.check}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      ) : null}
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
}: PhotoSelectGridProps) {
  const { width } = useWindowDimensions();
  const size = (width - theme.spacing.lg * 2) / COLS;
  const selected = new Set(selectedAssetIds);

  useEffect(() => {
    return () => {
      // Drop decoded bitmaps when leaving card create (large months).
      void Image.clearMemoryCache();
    };
  }, []);

  const rows = useMemo(
    () => (sections != null ? rowsFromSections(sections) : rowsFromPhotos(photos)),
    [photos, sections],
  );

  const header = (
    <View>
      {ListHeaderComponent}
      {sectionsLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
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
      windowSize={5}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      renderItem={({ item }) => {
        if (item.kind === 'header') {
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{item.title}</Text>
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
      }}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.ink,
  },
  placeholder: {
    opacity: 0.12,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: theme.colors.background,
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
  sectionTitle: {
    ...theme.type.label,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  photoRow: {
    flexDirection: 'row',
  },
});
