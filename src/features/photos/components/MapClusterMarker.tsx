import { useEffect, useMemo, useState } from 'react';

import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

import { theme } from '@/shared/constants/theme';

import { resolveAssetFileUri } from '../services/mediaLibrary';
import type { PlaceCluster } from '../types';

const CARD = 38;
const CARD_SELECTED = 44;
/** Tip allowance so the photo sits above the geo point (anchor y=1). */
const TIP = 8;

export interface MapClusterMarkerProps {
  cluster: PlaceCluster;
  selected: boolean;
  coverAssetId?: string | null;
  onSelect: (cluster: PlaceCluster) => void;
}

/**
 * Photo map pin via Naver's native `image` prop (file:// / https).
 *
 * Custom React children are snapshotted with UIView `renderInContext`, which
 * does not paint RN Image contents reliably on device — that left beige empty
 * frames on TestFlight. Native httpUri loading reads file:// with NSData.
 */
export function MapClusterMarker({
  cluster,
  selected,
  coverAssetId,
  onSelect,
}: MapClusterMarkerProps) {
  const cover =
    coverAssetId && cluster.photos.some((p) => p.assetId === coverAssetId)
      ? cluster.photos.find((p) => p.assetId === coverAssetId)
      : undefined;
  const display = cover ?? cluster.photos[0];
  const displayAssetId = display?.assetId;

  const cardSize = selected ? CARD_SELECTED : CARD;
  const markerW = cardSize;
  const markerH = cardSize + TIP;

  const [fileUri, setFileUri] = useState<string | null>(null);

  useEffect(() => {
    if (!displayAssetId) {
      setFileUri(null);
      return;
    }
    let cancelled = false;
    setFileUri(null);

    const load = async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const next = await resolveAssetFileUri(displayAssetId);
        if (cancelled) {
          return;
        }
        if (next) {
          setFileUri(next);
          return;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [displayAssetId]);

  const image = useMemo(() => {
    if (fileUri) {
      return {
        httpUri: fileUri,
        reuseIdentifier: `pin-${displayAssetId ?? 'x'}`,
      };
    }
    // Neutral placeholder until the thumb file is ready.
    return { symbol: 'gray' as const };
  }, [fileUri, displayAssetId]);

  const count = cluster.photos.length;

  return (
    <NaverMapMarkerOverlay
      latitude={cluster.centerLat}
      longitude={cluster.centerLng}
      width={markerW}
      height={markerH}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={selected ? 2 : 1}
      isHideCollidedSymbols
      image={image}
      tintColor={selected ? theme.colors.accent : undefined}
      caption={
        count > 1
          ? {
              text: String(count),
              color: theme.colors.ink,
              haloColor: theme.colors.background,
              textSize: 11,
              offset: 2,
            }
          : undefined
      }
      onTap={() => onSelect(cluster)}
    />
  );
}
