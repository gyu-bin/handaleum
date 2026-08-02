import { useEffect, useMemo, useRef, useState } from 'react';

import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';
import type { MapImageProp } from '@mj-studio/react-native-naver-map';

import { theme } from '@/shared/constants/theme';

import { resolveAssetFileUri } from '../services/mediaLibrary';
import { requestMapPinBake } from '../services/mapPinBake';
import type { PlaceCluster } from '../types';

const CARD = 38;
const CARD_SELECTED = 44;
const BORDER = 2.5;
const CARET_H = 8;

/** Dawn-blue default pin while thumb export is still in the concurrency queue. */
const PLACEHOLDER_IMAGE: MapImageProp = {
  symbol: 'lightblue',
  reuseIdentifier: 'handaleum-pin-placeholder',
};

export interface MapClusterMarkerProps {
  cluster: PlaceCluster;
  selected: boolean;
  coverAssetId?: string | null;
  onSelect: (cluster: PlaceCluster) => void;
}

/**
 * Photo map pin. Placeholder symbol paints immediately; thumb file then paper
 * bake upgrade in the background (never hide the marker while exporting).
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
  // Sticky first asset for this mount so progressive member growth doesn't
  // thrash exports (cover still wins when set).
  const stickyAssetRef = useRef<string | null>(null);
  const displayAssetId = useMemo(() => {
    if (cover?.assetId) {
      return cover.assetId;
    }
    const prev = stickyAssetRef.current;
    if (prev && cluster.photos.some((p) => p.assetId === prev)) {
      return prev;
    }
    const next = cluster.photos[0]?.assetId ?? null;
    stickyAssetRef.current = next;
    return next;
  }, [cover?.assetId, cluster.photos]);


  const cardSize = selected ? CARD_SELECTED : CARD;
  const markerW = cardSize + BORDER * 2;
  const markerH = markerW + CARET_H;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  /** Framed bake when ready; until then we show the raw thumb file. */
  const [framedUri, setFramedUri] = useState<string | null>(null);
  const lastHttpRef = useRef<MapImageProp | null>(null);
  const loadedAssetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!displayAssetId) {
      setPhotoUri(null);
      setFramedUri(null);
      lastHttpRef.current = null;
      loadedAssetRef.current = null;
      return;
    }
    let cancelled = false;

    const load = async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const next = await resolveAssetFileUri(displayAssetId);
          if (cancelled) {
            return;
          }
          if (next) {
            loadedAssetRef.current = displayAssetId;
            setPhotoUri(next);
            // Immediate pin: raw thumb. Do not wait for view-shot bake.
            setFramedUri(null);
            return;
          }
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        }
      } catch (error) {
        console.warn('MapClusterMarker load failed', displayAssetId, error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [displayAssetId]);

  useEffect(() => {
    if (!photoUri || !displayAssetId) {
      return;
    }
    let cancelled = false;
    void requestMapPinBake(photoUri, selected, cardSize)
      .then((baked) => {
        if (!cancelled && baked && loadedAssetRef.current === displayAssetId) {
          setFramedUri(baked);
        }
      })
      .catch((error) => {
        console.warn('map pin bake request failed', error);
      });
    return () => {
      cancelled = true;
    };
  }, [photoUri, selected, cardSize, displayAssetId]);

  const image = useMemo((): MapImageProp => {
    const uri = framedUri ?? photoUri;
    if (uri && displayAssetId) {
      const next: MapImageProp = {
        httpUri: uri,
        reuseIdentifier: framedUri
          ? `framed-${displayAssetId}-${selected ? 1 : 0}-${cardSize}`
          : `thumb-${displayAssetId}-${cardSize}`,
      };
      lastHttpRef.current = next;
      return next;
    }
    // Keep previous photo while the next asset loads; else show symbol now.
    return lastHttpRef.current ?? PLACEHOLDER_IMAGE;
  }, [framedUri, photoUri, displayAssetId, selected, cardSize]);

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
