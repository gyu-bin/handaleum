import { memo, useEffect, useState, type ReactElement } from 'react';
import {
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

export interface PhotoSelectGridProps {
  photos: PhotoRef[];
  selectedAssetIds: string[];
  onToggle: (assetId: string) => void;
  /** Rendered above the grid, inside the same (virtualized) scroll container. */
  ListHeaderComponent?: ReactElement | null;
  /** Rendered below the grid, inside the same scroll container. */
  ListFooterComponent?: ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
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
    void resolveAssetUri(photo.assetId).then((next) => {
      if (!cancelled) {
        setUri(next);
      }
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
        <Image source={{ uri }} style={styles.image} contentFit="cover" />
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
 */
export function PhotoSelectGrid({
  photos,
  selectedAssetIds,
  onToggle,
  ListHeaderComponent,
  ListFooterComponent,
  contentContainerStyle,
  keyboardShouldPersistTaps,
}: PhotoSelectGridProps) {
  const { width } = useWindowDimensions();
  const size = (width - theme.spacing.lg * 2) / 3;
  const selected = new Set(selectedAssetIds);

  return (
    <FlatList
      data={photos}
      keyExtractor={(item) => item.assetId}
      numColumns={3}
      extraData={selectedAssetIds}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      contentContainerStyle={contentContainerStyle}
      renderItem={({ item }) => (
        <Cell
          photo={item}
          selected={selected.has(item.assetId)}
          size={size}
          onToggle={onToggle}
        />
      )}
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
});
