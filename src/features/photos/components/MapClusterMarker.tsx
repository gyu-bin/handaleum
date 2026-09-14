import { memo, useEffect, useMemo, useRef, useState } from 'react';

import type { MapImageProp } from '@mj-studio/react-native-naver-map';
import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

import { requestMapPinBake } from '../services/mapPinBake';
import {
  peekAssetFileUri,
  resolveAssetFileUri,
  waitWhilePinExportBusy,
} from '../services/mediaLibrary';
import type { PlaceCluster } from '../types';

/** Photo pin size — ~44–52 design target. Multi-photo clusters use the cover image too. */
const CARD = 48;
const CARD_SELECTED = 52;
const BORDER = 2;
const CARET_H = 6;

/** Earliest photo in the cluster — stable React key across zoom grain changes. */
export function clusterSeedId(cluster: PlaceCluster): string {
  return cluster.photos[0]?.assetId ?? cluster.id;
}

export interface MapClusterMarkerProps {
  cluster: PlaceCluster;
  selected: boolean;
  coverAssetId?: string | null;
  onSelect: (cluster: PlaceCluster) => void;
}

function MapClusterMarkerInner({
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

  const [resolved, setResolved] = useState<{
    id: string;
    uri: string;
  } | null>(null);
  /** Framed bake when ready; until then we show the raw thumb file. */
  const [framedUri, setFramedUri] = useState<string | null>(null);
  const lastHttpRef = useRef<MapImageProp | null>(null);

  const photoUri =
    (resolved?.id === displayAssetId ? resolved.uri : null) ??
    (displayAssetId ? peekAssetFileUri(displayAssetId) : null);

  useEffect(() => {
    if (!displayAssetId) {
      setResolved(null);
      setFramedUri(null);
      lastHttpRef.current = null;
      return;
    }
    const peek = peekAssetFileUri(displayAssetId);
    if (peek) {
      setResolved({ id: displayAssetId, uri: peek });
      return;
    }
    let cancelled = false;
    const MAX_BURST = 6;
    const load = async () => {
      let attempt = 0;
      try {
        while (!cancelled && attempt < MAX_BURST) {
          const next = await resolveAssetFileUri(displayAssetId);
          if (cancelled) {
            return;
          }
          if (next) {
            setResolved({ id: displayAssetId, uri: next });
            setFramedUri(null);
            return;
          }
          attempt += 1;
          if (attempt % 2 === 0) {
            await waitWhilePinExportBusy(3000);
          }
          if (cancelled) {
            return;
          }
          await new Promise((r) => setTimeout(r, Math.min(1600, 220 * attempt)));
        }
        if (cancelled) {
          return;
        }
        await waitWhilePinExportBusy(5000);
        if (cancelled) {
          return;
        }
        await new Promise((r) => setTimeout(r, 10_000));
        if (cancelled) {
          return;
        }
        const late = await resolveAssetFileUri(displayAssetId);
        if (!cancelled && late) {
          setResolved({ id: displayAssetId, uri: late });
          setFramedUri(null);
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

  // Always bake as a photo pin (no numeric cluster badge).
  useEffect(() => {
    if (!photoUri || !displayAssetId) {
      setFramedUri(null);
      return;
    }
    let cancelled = false;
    void requestMapPinBake(photoUri, selected, cardSize, 1)
      .then((baked) => {
        if (!cancelled && baked) {
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

  const image = useMemo((): MapImageProp | null => {
    const uri = framedUri ?? photoUri;
    if (uri && displayAssetId) {
      const next: MapImageProp = {
        httpUri: uri,
        reuseIdentifier: framedUri
          ? `framed-v4-${displayAssetId}-${cardSize}`
          : `thumb-${displayAssetId}-${cardSize}`,
      };
      lastHttpRef.current = next;
      return next;
    }
    return lastHttpRef.current;
  }, [framedUri, photoUri, displayAssetId, cardSize]);

  if (!image) {
    return null;
  }

  return (
    <NaverMapMarkerOverlay
      latitude={cluster.centerLat}
      longitude={cluster.centerLng}
      width={markerW}
      height={markerH}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={selected ? 10 : 2}
      alpha={photoUri && !framedUri ? 0.4 : 1}
      // Hide under map POI labels only — do not drop neighboring photo pins.
      isHideCollidedSymbols
      isForceShowIcon={selected}
      image={image}
      onTap={() => onSelect(cluster)}
    />
  );
}

export const MapClusterMarker = memo(
  MapClusterMarkerInner,
  (a, b) =>
    clusterSeedId(a.cluster) === clusterSeedId(b.cluster) &&
    a.selected === b.selected &&
    a.coverAssetId === b.coverAssetId &&
    a.cluster.centerLat === b.cluster.centerLat &&
    a.cluster.centerLng === b.cluster.centerLng &&
    a.cluster.photos.length === b.cluster.photos.length &&
    a.onSelect === b.onSelect,
);
