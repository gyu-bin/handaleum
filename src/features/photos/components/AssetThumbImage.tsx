import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { useGridThumbUri } from '../hooks/useGridThumbUri';
import type { DummyImageSize } from '../services/dummyPhotos';

export interface AssetThumbImageProps {
  assetId: string;
  /** Layout edge length (px). Also used as decode budget hint. */
  size: number;
  style?: StyleProp<ImageStyle>;
  imageSize?: DummyImageSize;
}

/**
 * Camera-roll thumb for dense grids — fixed size, no fade, recycle-friendly.
 */
export const AssetThumbImage = memo(function AssetThumbImage({
  assetId,
  size,
  style,
  imageSize = 128,
}: AssetThumbImageProps) {
  const uri = useGridThumbUri(assetId, imageSize);

  if (!uri) {
    return (
      <View
        style={[
          styles.placeholder,
          { width: size, height: size },
          style as object,
        ]}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      contentFit="cover"
      recyclingKey={assetId}
      cachePolicy="memory-disk"
      transition={0}
      priority="low"
      allowDownscaling
    />
  );
});

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: theme.colors.surfaceAlt,
  },
});
