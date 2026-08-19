import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { PhotoRef } from '../../photos/types';
import { collageRects, COLLAGE_MAX, type CollageRect } from '../utils/collageLayout';

export function CollagePlaceChip({
  label,
  scale = 1,
}: {
  label: string;
  scale?: number;
}) {
  const s = Math.max(0.85, Math.min(1.15, scale));
  return (
    <View
      pointerEvents="none"
      style={[
        styles.chip,
        {
          right: 4 * s,
          bottom: 4 * s,
          paddingHorizontal: 5 * s,
          paddingVertical: 2 * s,
          maxWidth: '86%',
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.chipText, { fontSize: 8.5 * s, lineHeight: 11 * s }]}
      >
        {label}
      </Text>
    </View>
  );
}

function CollageCell({
  assetId,
  rect,
  radius,
  placeLabel,
  chipScale,
  onSettled,
}: {
  assetId: string;
  rect: CollageRect;
  radius: number;
  placeLabel?: string;
  chipScale: number;
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
    void resolveAssetUri(assetId)
      .then((next) => {
        if (cancelled) {
          return;
        }
        setUri(next);
        if (!next) {
          settle();
        }
      })
      .catch((error) => {
        console.warn('CollageCell uri failed', assetId, error);
        if (!cancelled) {
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
          recyclingKey={assetId}
          cachePolicy="memory-disk"
          onLoad={settle}
          onError={settle}
        />
      ) : null}
      {placeLabel ? (
        <CollagePlaceChip label={placeLabel} scale={chipScale} />
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
  /** Short 구/시 labels, same order as photos. */
  placeLabels?: string[];
  /** Fires once when every cell has resolved URI + image load (or failed). */
  onReady?: () => void;
}

/** Static 1–5 photo collage. Rendered in the card template (and export). */
export function CardCollage({
  photos,
  width,
  height,
  gutter = 6,
  radius = 4,
  placeLabels,
  onReady,
}: CardCollageProps) {
  const shown = photos.slice(0, COLLAGE_MAX);
  const rects = collageRects(shown.length, width, height, gutter);
  const chipScale = width / 270;
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
          placeLabel={placeLabels?.[i]?.trim() || undefined}
          chipScale={chipScale}
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
  chip: {
    position: 'absolute',
    backgroundColor: theme.colors.overlay,
    borderRadius: 2,
  },
  chipText: {
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
});
