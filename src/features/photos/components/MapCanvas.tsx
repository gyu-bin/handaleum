import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  NaverMapView,
  type CameraChangeReason,
  type NaverMapViewRef,
} from '@mj-studio/react-native-naver-map';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { PlaceCluster } from '../types';
import { placeBucketKey } from '../utils/placeJourney';
import { clusterSeedId, MapClusterMarker } from './MapClusterMarker';
import { MapPinBakeHost } from './MapPinBakeHost';

/** Approximate zoom from latitude span (clustering grain). */
export function zoomFromLatitudeDelta(latitudeDelta: number): number {
  const delta = Math.max(latitudeDelta, 0.0008);
  return Math.max(5, Math.min(18, Math.log2(180 / delta)));
}

/** Naver zoom ≈ mid-Korea overview (empty month fallback only). */
export const DEFAULT_MAP_ZOOM = 7;

/** @deprecated Prefer zoomFromLatitudeDelta — kept for call-site compatibility. */
export function zoomFromScale(scale: number): number {
  return Math.max(5, Math.min(18, 8 + Math.log2(Math.max(0.01, scale))));
}

export const DEFAULT_MAP_SCALE = 1.6;

/** Empty-month fallback only — never used when the month has photo markers. */
const EMPTY_CAMERA = {
  latitude: 36.4,
  longitude: 127.8,
  zoom: 6.8,
} as const;

/** Single-photo zoom after fit (marker fills the padded content area). */
const SINGLE_PHOTO_ZOOM = 14;

/**
 * Content insets for camera / chrome. Keep `bottom: 0` — Naver places the
 * logo inside content padding, so a bottom inset lifts it onto Jeju pins.
 * (Pre-mapPadding builds sat the logo at the true bottom-left.)
 */
const MAP_PADDING = {
  top: 120,
  right: 20,
  bottom: 0,
  // Keep left at 0 so the Naver logo can sit on the true left edge.
  left: 0,
} as const;

/** All four insets required — partial rect can break native logo align. */
const LOGO_MARGIN = {
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
} as const;

/** South Korea frame clamp — never fit-zoom past the peninsula. */
const KOREA_FRAME = {
  minLat: 33.05,
  maxLat: 38.65,
  minLng: 125.05,
  maxLng: 131.95,
} as const;

type PhotoBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  /** Mean of photo coords — denser mainland clusters outweigh Jeju outliers. */
  meanLat: number;
  meanLng: number;
};

/** Bounds + mean from every photo coordinate in the visible clusters. */
function boundsForClusters(clusters: PlaceCluster[]): PhotoBounds | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;
  for (const cluster of clusters) {
    for (const photo of cluster.photos) {
      count += 1;
      minLat = Math.min(minLat, photo.lat);
      maxLat = Math.max(maxLat, photo.lat);
      minLng = Math.min(minLng, photo.lng);
      maxLng = Math.max(maxLng, photo.lng);
      sumLat += photo.lat;
      sumLng += photo.lng;
    }
  }
  if (count === 0) {
    return null;
  }
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    meanLat: sumLat / count,
    meanLng: sumLng / count,
  };
}

/**
 * First-paint estimate only — real fit uses animateCameraWithTwoCoords.
 */
function cameraForClusters(clusters: PlaceCluster[]): {
  latitude: number;
  longitude: number;
  zoom: number;
} {
  const bounds = boundsForClusters(clusters);
  if (!bounds) {
    return { ...EMPTY_CAMERA };
  }
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.004);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.004);
  if (latSpan < 0.00015 && lngSpan < 0.00015) {
    return {
      latitude: bounds.meanLat,
      longitude: bounds.meanLng,
      zoom: SINGLE_PHOTO_ZOOM,
    };
  }
  const span = Math.max(latSpan * 1.08, lngSpan * 1.08, 0.2);
  return {
    latitude: (bounds.minLat + bounds.maxLat) / 2,
    longitude: (bounds.minLng + bounds.maxLng) / 2,
    // Native TwoCoords sets the real zoom; this is only the first paint guess.
    zoom: Math.min(
      SINGLE_PHOTO_ZOOM,
      Math.max(6.4, Math.round(zoomFromLatitudeDelta(span))),
    ),
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
  /** Last frameKey we ran an auto/forced fit for. */
  const fittedKeyRef = useRef<string>('');
  /** True once that fit included at least one pin (allows empty→pins follow-up). */
  const fittedWithPinsRef = useRef(false);
  /**
   * User pan / pinch (or native control). Blocks further auto-fit until month
   * changes — progressive GPS / recluster must not yank the camera.
   */
  const userMovedCameraRef = useRef(false);

  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const initialCamera = cameraForClusters(clusters);

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

  /**
   * Fit all photo markers into the padded content area (max zoom that still
   * shows every pin). `force` bypasses the user-moved gate (⌂ / month entry).
   */
  const fitToPhotos = useCallback(
    (animated: boolean, force = false) => {
      const map = mapRef.current;
      if (!map || !mapReadyRef.current) {
        return false;
      }
      if (!force && userMovedCameraRef.current) {
        return false;
      }
      const list = clustersRef.current;
      const duration = animated ? 320 : 0;
      const bounds = boundsForClusters(list);
      if (!bounds) {
        map.animateCameraTo({ ...EMPTY_CAMERA, duration, easing: 'EaseOut' });
        reportZoom(EMPTY_CAMERA.zoom, true);
        return true;
      }

      const latSpan = bounds.maxLat - bounds.minLat;
      const lngSpan = bounds.maxLng - bounds.minLng;

      // One pin (or stacked same GPS): center + comfortable zoom.
      if (latSpan < 0.00015 && lngSpan < 0.00015) {
        map.animateCameraTo({
          latitude: bounds.meanLat,
          longitude: bounds.meanLng,
          zoom: SINGLE_PHOTO_ZOOM,
          duration,
          easing: 'EaseOut',
        });
        reportZoom(SINGLE_PHOTO_ZOOM, true);
        return true;
      }

      // Tight pad on pin bbox; clamp to South Korea so NK/Japan/sea don't dominate.
      const padLat = Math.max(latSpan * 0.06, 0.04);
      const padLng = Math.max(lngSpan * 0.06, 0.04);
      const south = Math.max(bounds.minLat - padLat, KOREA_FRAME.minLat);
      const north = Math.min(bounds.maxLat + padLat, KOREA_FRAME.maxLat);
      const west = Math.max(bounds.minLng - padLng, KOREA_FRAME.minLng);
      const east = Math.min(bounds.maxLng + padLng, KOREA_FRAME.maxLng);
      map.animateCameraWithTwoCoords({
        coord1: { latitude: south, longitude: west },
        coord2: { latitude: north, longitude: east },
        duration,
        easing: 'EaseOut',
      });
      reportZoom(
        Math.max(6.4, zoomFromLatitudeDelta(Math.max(north - south, east - west))),
        true,
      );
      return true;
    },
    [reportZoom],
  );

  // Month / frame change → allow auto-fit again and snap to photo bounds.
  useEffect(() => {
    fittedKeyRef.current = '';
    fittedWithPinsRef.current = false;
    userMovedCameraRef.current = false;
    if (!mapReadyRef.current) {
      return;
    }
    if (fitToPhotos(false, true)) {
      fittedKeyRef.current = frameKey;
      fittedWithPinsRef.current = clustersRef.current.length > 0;
    }
  }, [fitToPhotos, frameKey]);

  // Pins can arrive after an empty first fit — one follow-up, unless user moved.
  useEffect(() => {
    if (!mapReadyRef.current) {
      return;
    }
    if (userMovedCameraRef.current) {
      return;
    }
    if (fittedKeyRef.current === frameKey && fittedWithPinsRef.current) {
      return;
    }
    if (fitToPhotos(fittedKeyRef.current === frameKey, false)) {
      fittedKeyRef.current = frameKey;
      fittedWithPinsRef.current = clustersRef.current.length > 0;
    }
  }, [clusters, fitToPhotos, frameKey]);

  const onInitialized = useCallback(() => {
    mapReadyRef.current = true;
    userMovedCameraRef.current = false;
    if (fitToPhotos(false, true)) {
      fittedKeyRef.current = frameKey;
      fittedWithPinsRef.current = clustersRef.current.length > 0;
    }
  }, [fitToPhotos, frameKey]);

  const cameraCenterRef = useRef({
    latitude: initialCamera.latitude,
    longitude: initialCamera.longitude,
  });

  const onCameraChanged = useCallback(
    (params: { reason: CameraChangeReason }) => {
      if (params.reason === 'Gesture' || params.reason === 'Control') {
        userMovedCameraRef.current = true;
      }
    },
    [],
  );

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
      // Manual zoom control — treat as user intent (no further auto-fit).
      userMovedCameraRef.current = true;
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
        ref={mapRef}
        style={styles.map}
        mapType="Basic"
        locale="ko"
        isExtentBoundedInKorea
        initialCamera={initialCamera}
        mapPadding={MAP_PADDING}
        logoAlign="BottomLeft"
        logoMargin={LOGO_MARGIN}
        // Keep the map as quiet context; photo markers stay visually primary.
        // Naver does not expose per-POI styling, so the supported lightness and
        // symbol scale controls carry the decluttering work without masking pins.
        lightness={0.24}
        symbolScale={0.76}
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
        onCameraChanged={onCameraChanged}
        onCameraIdle={onCameraIdle}
      >
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
          style={({ pressed }) => [styles.zoomBtn, pressed && styles.zoomBtnPressed]}
          onPress={() => zoomByFactorCentered(1.6)}
          accessibilityLabel={strings.map.zoomIn}
        >
          <Text style={styles.zoomBtnText}>+</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.zoomBtn, pressed && styles.zoomBtnPressed]}
          onPress={() => zoomByFactorCentered(1 / 1.6)}
          accessibilityLabel={strings.map.zoomOut}
        >
          <Text style={styles.zoomBtnText}>−</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.zoomBtn, pressed && styles.zoomBtnPressed]}
          onPress={() => {
            // Explicit reset — always allowed; does not re-open auto-fit gate.
            if (fitToPhotos(true, true)) {
              fittedKeyRef.current = frameKey;
              fittedWithPinsRef.current = clustersRef.current.length > 0;
            }
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
    right: 14,
    // Sit above create chip (~44 tall + pad).
    bottom: 84,
    gap: 10,
    zIndex: 2,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  zoomBtnPressed: {
    opacity: 0.7,
  },
  zoomBtnText: {
    fontSize: 20,
    color: theme.colors.ink,
    lineHeight: 22,
    fontWeight: '500',
  },
  zoomBtnHome: {
    fontSize: 16,
    color: theme.colors.ink,
    fontWeight: '500',
  },
});
