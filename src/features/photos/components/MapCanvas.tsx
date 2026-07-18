import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ResumableZoom,
  useTransformationState,
  type ResumableZoomRefType,
} from 'react-native-zoom-toolkit';

import { getMapPalette } from '@/shared/constants/mapThemes';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useMapProjection } from '../hooks/useMapProjection';
import type { MapThemeId, PlaceCluster } from '../types';
import { fitPinsCamera } from '../utils/fitPinsCamera';
import { placeBucketKey } from '../utils/placeJourney';
import { ClusterPin } from './ClusterPin';
import { MapAnchor } from './MapAnchor';
import { MapSvg } from './MapSvg';

const MIN_SCALE = 1;
/** Enough headroom after fit (~1.3–3.5) to read 시 boundaries up close. */
const MAX_SCALE = 18;
const MAX_FIT_SCALE = 3.5;
const MIN_FIT_SCALE = 1.35;
const ZOOM_STEP = 1.55;

/** Zoom level (used for clustering radius) derived from the map scale. */
export function zoomFromScale(scale: number): number {
  return Math.max(6, Math.min(18, 8 + Math.log2(Math.max(0.01, scale))));
}

export const DEFAULT_MAP_ZOOM = zoomFromScale(MIN_FIT_SCALE);
export const DEFAULT_MAP_SCALE = MIN_FIT_SCALE;

export interface MapCanvasProps {
  clusters: PlaceCluster[];
  onZoomChange: (zoom: number) => void;
  /** Raw ResumableZoom scale — used for visit-scope grain (도/시/동). */
  onScaleChange?: (scale: number) => void;
  onSelectCluster: (cluster: PlaceCluster) => void;
  selectedClusterId?: string | null;
  themeId?: MapThemeId;
  /** placeKey → cover assetId */
  pinCovers?: Record<string, string>;
}

export function MapCanvas({
  clusters,
  onZoomChange,
  onScaleChange,
  onSelectCluster,
  selectedClusterId,
  themeId = 'dawn',
  pinCovers = {},
}: MapCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const zoomRef = useRef<ResumableZoomRefType>(null);
  const framedKeyRef = useRef<string>('');
  const { onUpdate, state } = useTransformationState('common');
  const palette = getMapPalette(themeId);

  const { koreaPath, provincePaths, cityPaths, labels, pinPositions } =
    useMapProjection(size, clusters);

  const photosKey = useMemo(() => {
    const ids = clusters.flatMap((c) => c.photos.map((p) => p.assetId));
    ids.sort();
    return ids.join('|');
  }, [clusters]);

  const reportScale = (scale: number) => {
    onZoomChange(zoomFromScale(scale));
    onScaleChange?.(scale);
  };

  const frameMonth = (animate: boolean) => {
    if (size.width === 0 || size.height === 0) {
      return;
    }
    const camera = fitPinsCamera(
      pinPositions.map(({ x, y }) => ({ x, y })),
      size.width,
      size.height,
      {
        minScale: MIN_SCALE,
        maxScale: MAX_SCALE,
        maxFitScale: MAX_FIT_SCALE,
        minFitScale: MIN_FIT_SCALE,
      },
    );
    zoomRef.current?.setTransformState(camera, animate);
    reportScale(camera.scale);
  };

  useEffect(() => {
    if (size.width === 0 || size.height === 0) {
      return;
    }
    // Frame only when the photo set changes — never when layout height
    // shifts (VisitScopeBar / footer growing after zoom would otherwise
    // snap the camera back to the fit view).
    if (photosKey === framedKeyRef.current) {
      return;
    }
    framedKeyRef.current = photosKey;
    const id = requestAnimationFrame(() => {
      frameMonth(true);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- photosKey guards framing; size only gates readiness
  }, [size.width, size.height, photosKey]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const handleGestureEnd = () => {
    const current = zoomRef.current?.getState();
    if (current) {
      reportScale(current.scale);
    }
  };

  const zoomBy = (factor: number) => {
    const current = zoomRef.current?.getState();
    if (!current) {
      return;
    }
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
    zoomRef.current?.zoom(next);
    reportScale(next);
  };

  const resetView = () => {
    frameMonth(true);
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.frame,
          {
            backgroundColor: palette.frameBg,
            borderColor: palette.frameBorder,
          },
        ]}
        onLayout={onLayout}
      >
        {size.width > 0 && size.height > 0 ? (
          <>
            <ResumableZoom
              ref={zoomRef}
              style={{ width: size.width, height: size.height }}
              minScale={MIN_SCALE}
              maxScale={MAX_SCALE}
              panMode="clamp"
              scaleMode="clamp"
              pinchEnabled
              panEnabled
              tapsEnabled
              allowPinchPanning
              onUpdate={onUpdate}
              onGestureEnd={handleGestureEnd}
            >
              <View style={{ width: size.width, height: size.height }}>
                <MapSvg
                  width={size.width}
                  height={size.height}
                  koreaPath={koreaPath}
                  provincePaths={provincePaths}
                  cityPaths={cityPaths}
                  labels={labels}
                  themeId={themeId}
                />
              </View>
            </ResumableZoom>

            <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
              {pinPositions.map(({ cluster, x, y }) => {
                const placeKey = placeBucketKey(cluster.centerLat, cluster.centerLng);
                return (
                  <MapAnchor
                    key={cluster.id}
                    x={x}
                    y={y}
                    width={size.width}
                    height={size.height}
                    camera={state}
                    interactive
                  >
                    <ClusterPin
                      cluster={cluster}
                      selected={selectedClusterId === cluster.id}
                      onPress={onSelectCluster}
                      coverAssetId={pinCovers[placeKey]}
                    />
                  </MapAnchor>
                );
              })}
            </View>
          </>
        ) : null}

        <View style={styles.zoomCtl} pointerEvents="box-none">
          <Pressable
            style={styles.zoomBtn}
            onPress={() => zoomBy(ZOOM_STEP)}
            accessibilityLabel={strings.map.zoomIn}
          >
            <Text style={styles.zoomBtnText}>+</Text>
          </Pressable>
          <Pressable
            style={styles.zoomBtn}
            onPress={() => zoomBy(1 / ZOOM_STEP)}
            accessibilityLabel={strings.map.zoomOut}
          >
            <Text style={styles.zoomBtnText}>−</Text>
          </Pressable>
          <Pressable
            style={styles.zoomBtn}
            onPress={resetView}
            accessibilityLabel={strings.map.resetView}
          >
            <Text style={styles.zoomBtnHome}>⌂</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 280,
  },
  frame: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  overlay: {
    zIndex: 1,
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
