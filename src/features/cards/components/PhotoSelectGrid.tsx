import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { PhotoRef } from '../../photos/types';

export interface PhotoSelectGridProps {
  photos: PhotoRef[];
  selectedAssetIds: string[];
  onToggle: (assetId: string) => void;
}

function Cell({
  photo,
  selected,
  size,
  onToggle,
}: {
  photo: PhotoRef;
  selected: boolean;
  size: number;
  onToggle: () => void;
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
      onPress={onToggle}
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
}

export function PhotoSelectGrid({
  photos,
  selectedAssetIds,
  onToggle,
}: PhotoSelectGridProps) {
  const { width } = useWindowDimensions();
  const size = (width - theme.spacing.md * 2) / 3;
  const selected = new Set(selectedAssetIds);

  return (
    <FlatList
      data={photos}
      keyExtractor={(item) => item.assetId}
      numColumns={3}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <Cell
          photo={item}
          selected={selected.has(item.assetId)}
          size={size}
          onToggle={() => onToggle(item.assetId)}
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
