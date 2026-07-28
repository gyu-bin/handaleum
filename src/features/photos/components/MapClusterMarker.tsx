import { useEffect, useMemo, useState } from 'react';

import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

import { theme } from '@/shared/constants/theme';

import { resolveAssetFileUri } from '../services/mediaLibrary';
import { requestMapPinBake } from '../services/mapPinBake';
import type { PlaceCluster } from '../types';

const CARD = 38;
const CARD_SELECTED = 44;
const BORDER = 2.5;
const CARET_H = 8;

export interface MapClusterMarkerProps {
  cluster: PlaceCluster;
  selected: boolean;
  coverAssetId?: string | null;
  onSelect: (cluster: PlaceCluster) => void;
}

/**
 * Photo map pin: paper frame + caret, delivered as a pre-baked PNG via Naver
 * `image.httpUri` (custom React children don't paint RN Image on device).
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
  const markerW = cardSize + BORDER * 2;
  const markerH = markerW + CARET_H;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pinUri, setPinUri] = useState<string | null>(null);

  useEffect(() => {
    if (!displayAssetId) {
      setPhotoUri(null);
      return;
    }
    let cancelled = false;
    setPhotoUri(null);
    setPinUri(null);

    const load = async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const next = await resolveAssetFileUri(displayAssetId);
        if (cancelled) {
          return;
        }
        if (next) {
          setPhotoUri(next);
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

  useEffect(() => {
    if (!photoUri) {
      setPinUri(null);
      return;
    }
    let cancelled = false;
    setPinUri(null);
    void requestMapPinBake(photoUri, selected, cardSize).then((baked) => {
      if (!cancelled) {
        setPinUri(baked);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photoUri, selected, cardSize]);

  const image = useMemo(() => {
    if (pinUri) {
      return {
        httpUri: pinUri,
        reuseIdentifier: `framed-${displayAssetId ?? 'x'}-${selected ? 1 : 0}-${cardSize}`,
      };
    }
    return { symbol: 'gray' as const };
  }, [pinUri, displayAssetId, selected, cardSize]);

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
