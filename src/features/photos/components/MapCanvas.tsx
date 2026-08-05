import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NaverMapPolylineOverlay,
  NaverMapView,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { PlaceCluster } from '../types';
import { journeyPathCoords } from '../utils/journeyPath';
import { placeBucketKey } from '../utils/placeJourney';
import { clusterSeedId, MapClusterMarker } from './MapClusterMarker';
import { MapPinBakeHost } from './MapPinBakeHost';

/** Approximate zoom from latitude span (clustering grain). */
export function zoomFromLatitudeDelta(latitudeDelta: number): number {
  const delta = Math.max(latitudeDelta, 0.0008);
  return Math.max(5, Math.min(18, Math.log2(180 / delta)));
}

/** Naver zoom ≈ mid-Korea overview. */
export const DEFAULT_MAP_ZOOM = 7;

/** @deprecated Prefer zoomFromLatitudeDelta — kept for call-site compatibility. */
export function zoomFromScale(scale: number): number {
  return Math.max(5, Math.min(18, 8 + Math.log2(Math.max(0.01, scale))));
}

export const DEFAULT_MAP_SCALE = 1.6;

const KOREA_CAMERA = {
  latitude: 36.45,
  longitude: 127.85,
  zoom: 7,
} as const;

function cameraForClusters(clusters: PlaceCluster[]): {
  latitude: number;
  longitude: number;
  zoom: number;
} {
  if (clusters.length === 0) {
    return { ...KOREA_CAMERA };
  }
  if (clusters.length === 1) {
    const only = clusters[0]!;
    return {
      latitude: only.centerLat,
      longitude: only.centerLng,
      zoom: 13,
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const cluster of clusters) {
    minLat = Math.min(minLat, cluster.centerLat);
    maxLat = Math.max(maxLat, cluster.centerLat);
    minLng = Math.min(minLng, cluster.centerLng);
    maxLng = Math.max(maxLng, cluster.centerLng);
  }
  const latDelta = Math.max((maxLat - minLat) * 1.45, 0.08);
  const lngDelta = Math.max((maxLng - minLng) * 1.45, 0.08);
  const span = Math.max(latDelta, lngDelta);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    zoom: Math.round(zoomFromLatitudeDelta(span)),
  };
}

/** @deprecated Region helper kept for callers; prefer cameraForClusters. */
export function regionForClusters(clusters: PlaceCluster[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  const cam = cameraForClusters(clusters);
  const delta = 180 / 2 ** cam.zoom;
  return {
    latitude: cam.latitude,
    longitude: cam.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

export interface MapCanvasProps {
  clusters: PlaceCluster[];
  onZoomChange: (zoom: number) => void;
  onScaleChange?: (scale: number) => void;
  onSelectCluster: (cluster: PlaceCluster) => void;
  /** Seed assetId of the selected pin (stable across zoom grain changes). */
  selectedClusterId?: string | null;
  pinCovers?: Record<string, string>;
  /**
   * Identity of the photo set the camera should frame — the month key.
   * Time-slider filtering must not yank the camera on every drag frame.
   */
  frameKey: string;
}

/**
 * Home map: Naver Dynamic Map + photo cluster markers.
 * Requires a development build (not Expo Go).
 * Memoized so header chips / stamp badge updates don't rebuild native markers.
 */
export const MapCanvas = memo(function MapCanvas({
  clusters,
  onZoomChange,
  onScaleChange,
  onSelectCluster,
  selectedClusterId,
  pinCovers = {},
  frameKey,
}: MapCanvasProps) {
  const mapRef = useRef<NaverMapViewRef>(null);
  const clustersRef = useRef(clusters);
  clustersRef.current = clusters;

  const reportedZoomRef = useRef(DEFAULT_MAP_ZOOM);
  const mapReadyRef = useRef(false);
  const fittedKeyRef = useRef<string>('');
  const fittedWithPinsRef = useRef(false);

  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const initialCamera = cameraForClusters(clusters);
  const pathCoords = useMemo(() => journeyPathCoords(clusters), [clusters]);

  const reportZoom = useCallback(
    (nextZoom: number, force = false) => {
      const quantized = Math.round(nextZoom);
      if (!force && quantized === Math.round(reportedZoomRef.current)) {
        return;
      }
      reportedZoomRef.current = quantized;
      setZoom(quantized);
      onZoomChange(quantized);
      onScaleChange?.(Math.max(1, 2 ** (quantized - 8)));
    },
    [onScaleChange, onZoomChange],
  );

  const fitToPhotos = useCallback(
    (animated: boolean) => {
      const map = mapRef.current;
      if (!map || !mapReadyRef.current) {
        return false;
      }
      const list = clustersRef.current;
      const duration = animated ? 320 : 0;
      if (list.length === 0) {
        map.animateCameraTo({ ...KOREA_CAMERA, duration, easing: 'EaseOut' });
        reportZoom(KOREA_CAMERA.zoom, true);
        return true;
      }
      if (list.length === 1) {
        const only = list[0]!;
        map.animateCameraTo({
          latitude: only.centerLat,
          longitude: only.centerLng,
          zoom: 13,
          duration,
          easing: 'EaseOut',
        });
        reportZoom(13, true);
        return true;
      }

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const c of list) {
        minLat = Math.min(minLat, c.centerLat);
        maxLat = Math.max(maxLat, c.centerLat);
        minLng = Math.min(minLng, c.centerLng);
        maxLng = Math.max(maxLng, c.centerLng);
      }
      const padLat = Math.max((maxLat - minLat) * 0.2, 0.02);
      const padLng = Math.max((maxLng - minLng) * 0.2, 0.02);
      map.animateCameraWithTwoCoords({
        coord1: { latitude: minLat - padLat, longitude: minLng - padLng },
        coord2: { latitude: maxLat + padLat, longitude: maxLng + padLng },
        duration,
        easing: 'EaseOut',
      });
      return true;
    },
    [reportZoom],
  );

  useEffect(() => {
    mapReadyRef.current = false;
    fittedKeyRef.current = '';
    fittedWithPinsRef.current = false;
    reportZoom(cameraForClusters(clustersRef.current).zoom, true);
  }, [frameKey, reportZoom]);

  useEffect(() => {
    if (!mapReadyRef.current) {
      return;
    }
    if (clusters.length === 0) {
      return;
    }
    if (fittedKeyRef.current === frameKey && fittedWithPinsRef.current) {
      return;
    }
    if (fitToPhotos(false)) {
      fittedKeyRef.current = frameKey;
      fittedWithPinsRef.current = true;
    }
  }, [clusters.length, fitToPhotos, frameKey]);

  const onInitialized = useCallback(() => {
    mapReadyRef.current = true;
    if (fitToPhotos(false)) {
      fittedKeyRef.current = frameKey;
      fittedWithPinsRef.current = clustersRef.current.length > 0;
    }
  }, [fitToPhotos, frameKey]);

  const cameraCenterRef = useRef({
    latitude: initialCamera.latitude,
    longitude: initialCamera.longitude,
  });

  const onCameraIdle = useCallback(
    (params: { zoom?: number; latitude: number; longitude: number }) => {
      cameraCenterRef.current = {
        latitude: params.latitude,
        longitude: params.longitude,
      };
      if (typeof params.zoom === 'number') {
        reportZoom(params.zoom);
      }
    },
    [reportZoom],
  );

  const zoomByFactorCentered = useCallback(
    (factor: number) => {
      const map = mapRef.current;
      if (!map) {
        return;
      }
      const next = Math.max(5, Math.min(18, zoom + Math.log2(factor)));
      map.animateCameraTo({
        ...cameraCenterRef.current,
        zoom: next,
        duration: 280,
        easing: 'EaseOut',
      });
      reportZoom(next, true);
    },
    [reportZoom, zoom],
  );

  return (
    <View style={styles.wrap}>
      <NaverMapView
        key={frameKey}
        ref={mapRef}
        style={styles.map}
        mapType="Basic"
        locale="ko"
        isExtentBoundedInKorea
        initialCamera={initialCamera}
        // Declutter: hide building footprints/address glyphs. Base POI names
        // (parks, temples) cannot be filtered by Naver SDK — pin collision helps.
        layerGroups={{
          BUILDING: false,
          TRANSIT: false,
          TRAFFIC: false,
          BICYCLE: false,
          MOUNTAIN: false,
          CADASTRAL: false,
        }}
        buildingHeight={0}
        isShowZoomControls={false}
        isShowCompass={false}
        isShowScaleBar={false}
        isRotateGesturesEnabled={false}
        isTiltGesturesEnabled={false}
        onInitialized={onInitialized}
        onCameraIdle={onCameraIdle}
      >
        {pathCoords.length >= 2 ? (
          <NaverMapPolylineOverlay
            coords={pathCoords}
            width={2.5}
            color={theme.tint.mid}
            capType="Round"
            joinType="Round"
            zIndex={0}
          />
        ) : null}
        {clusters.map((cluster) => {
          const seedId = clusterSeedId(cluster);
          const placeKey = placeBucketKey(cluster.centerLat, cluster.centerLng);
          return (
            <MapClusterMarker
              // Seed survives zoom grain changes — remounting every pin on
              // zoom was the flicker + native overlay churn.
              key={seedId}
              cluster={cluster}
              selected={selectedClusterId === seedId}
              coverAssetId={pinCovers[placeKey]}
              onSelect={onSelectCluster}
            />
          );
        })}
      </NaverMapView>

      <View style={styles.zoomCtl} pointerEvents="box-none">
        <Pressable
          style={styles.zoomBtn}
          onPress={() => zoomByFactorCentered(1.6)}
          accessibilityLabel={strings.map.zoomIn}
        >
          <Text style={styles.zoomBtnText}>+</Text>
        </Pressable>
        <Pressable
          style={styles.zoomBtn}
          onPress={() => zoomByFactorCentered(1 / 1.6)}
          accessibilityLabel={strings.map.zoomOut}
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </Pressable>
        <Pressable
          style={styles.zoomBtn}
          onPress={() => {
            fitToPhotos(true);
            fittedKeyRef.current = frameKey;
            fittedWithPinsRef.current = clustersRef.current.length > 0;
          }}
          accessibilityLabel={strings.map.resetView}
        >
          <Text style={styles.zoomBtnHome}>⌂</Text>
        </Pressable>
      </View>
      {/* Outside the map — view-shot bake host for framed pin PNGs. */}
      <MapPinBakeHost />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  zoomCtl: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    gap: 8,
    zIndex: 2,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  zoomBtnText: {
    fontSize: 18,
    color: theme.colors.ink,
    lineHeight: 20,
    fontWeight: '500',
  },
  zoomBtnHome: {
    fontSize: 14,
    color: theme.colors.inkSoft,
  },
});
