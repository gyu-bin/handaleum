import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { PhotoRef } from '../../photos/types';
import { collageRects, type CollageRect } from '../utils/collageLayout';

function CollageCell({
  assetId,
  rect,
  radius,
  onSettled,
}: {
  assetId: string;
  rect: CollageRect;
  radius: number;
  onSettled: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const settled = useRef(false);

  const settle = () => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    onSettled();
  };

  useEffect(() => {
    let cancelled = false;
    settled.current = false;
    void resolveAssetUri(assetId).then((next) => {
      if (cancelled) {
        return;
      }
      setUri(next);
      if (!next) {
        settle();
      }
    });
    return () => {
      cancelled = true;
    };
    // settle is stable enough via ref; assetId drives the work
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  return (
    <View
      style={[
        styles.cell,
        {
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          borderRadius: radius,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          onLoad={settle}
          onError={settle}
        />
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
  /** Fires once when every cell has resolved URI + image load (or failed). */
  onReady?: () => void;
}

/** Static 1–4 photo 인생네컷 collage. Rendered in the card template (and export). */
export function CardCollage({
  photos,
  width,
  height,
  gutter = 6,
  radius = 4,
  onReady,
}: CardCollageProps) {
  const shown = photos.slice(0, 4);
  const rects = collageRects(shown.length, width, height, gutter);
  const done = useRef(0);
  const reported = useRef(false);
  const photosKey = shown.map((p) => p.assetId).join('|');

  useEffect(() => {
    done.current = 0;
    reported.current = false;
    if (shown.length === 0) {
      reported.current = true;
      onReady?.();
    }
    // Reset readiness when the photo set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey, width, height]);

  const onSettled = () => {
    done.current += 1;
    if (done.current >= shown.length && !reported.current) {
      reported.current = true;
      onReady?.();
    }
  };

  return (
    <View style={{ width, height }}>
      {shown.map((photo, i) => (
        <CollageCell
          key={photo.assetId}
          assetId={photo.assetId}
          rect={rects[i]!}
          radius={radius}
          onSettled={onSettled}
        />
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
