import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { PhotoRef } from '../../photos/types';
import { collageRects, type CollageRect } from '../utils/collageLayout';

function CollageCell({ assetId, rect, radius }: {
  assetId: string;
  rect: CollageRect;
  radius: number;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolveAssetUri(assetId).then((next) => {
      if (!cancelled) {
        setUri(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <View
      style={[
        styles.cell,
        { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="cover" />
      ) : null}
    </View>
  );
}

export interface CardCollageProps {
  photos: PhotoRef[];
  /** Box width in points. */
  width: number;
  /** Box height in points. */
  height: number;
  gutter?: number;
  radius?: number;
}

/** Static 1–4 photo 인생네컷 collage. Rendered in the card template (and export). */
export function CardCollage({
  photos,
  width,
  height,
  gutter = 6,
  radius = 4,
}: CardCollageProps) {
  const shown = photos.slice(0, 4);
  const rects = collageRects(shown.length, width, height, gutter);
  return (
    <View style={{ width, height }}>
      {shown.map((photo, i) => (
        <CollageCell key={photo.assetId} assetId={photo.assetId} rect={rects[i]!} radius={radius} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
