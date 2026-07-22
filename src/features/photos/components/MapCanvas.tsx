import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { GeoBBox } from '../utils/geo';
import { placeBucketKey } from '../utils/placeJourney';
import { computeRebase, visibleRectForCamera } from '../utils/rebase';
import { ClusterPin } from './ClusterPin';
import { MapAnchor } from './MapAnchor';
import { MapSvg } from './MapSvg';

const MIN_SCALE = 1;
const MAX_FIT_SCALE = 3.5;
const MIN_FIT_SCALE = 1.35;
const ZOOM_STEP = 1.55;

/**
 * Total zoom budget relative to the full-Korea view — same ceiling the old
 * single-projection map had. The camera's per-gesture maxScale is derived
 * from this so chained rebases can never exceed it.
 */
const MAX_EFFECTIVE_SCALE = 18;

/**
 * Zoom-out allowance of a rebased base: the settled camera sits at this scale
 * over a base drawn for headroom x the visible region, so a pinch-out has room
 * before hitting the camera floor of 1. The SVG is oversampled by the same
 * factor, which is what makes the settled view render at native resolution.
 */
const REBASE_HEADROOM = 2;

/** |cameraScale - headroom| below this counts as already settled (pan-only). */
const SETTLE_EPSILON = 0.02;

/** Zoom buttons animate internally; settle after the motion has finished. */
const BUTTON_SETTLE_DELAY_MS = 380;

/** Zoom level (used for clustering radius) derived from the effective scale. */
export function zoomFromScale(scale: number): number {
  return Math.max(6, Math.min(18, 8 + Math.log2(Math.max(0.01, scale))));
}

export const DEFAULT_MAP_ZOOM = zoomFromScale(MIN_FIT_SCALE);
export const DEFAULT_MAP_SCALE = MIN_FIT_SCALE;

export interface MapCanvasProps {
  clusters: PlaceCluster[];
  onZoomChange: (zoom: number) => void;
  /** Effective scale vs the full-Korea fit — drives visit-scope grain (도/시/동). */
  onScaleChange?: (scale: number) => void;
  onSelectCluster: (cluster: PlaceCluster) => void;
  selectedClusterId?: string | null;
  themeId?: MapThemeId;
  /** placeKey → cover assetId */
  pinCovers?: Record<string, string>;
  /**
   * Identity of the photo set the camera should frame — the month key.
   * Deliberately NOT the filtered photos: the time slider must repaint pins
   * without yanking the camera back to the fit view on every drag frame.
   */
  frameKey: string;
}

export function MapCanvas({
  clusters,
  onZoomChange,
  onScaleChange,
  onSelectCluster,
  selectedClusterId,
  themeId = 'dawn',
  pinCovers = {},
  frameKey,
}: MapCanvasProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  /**
   * Geographic region the SVG is currently drawn for. null = full Korea.
   * Swapped at settle time ("rebase") so the settled view is always rendered
   * at native resolution instead of as a magnified raster.
   */
  const [baseBBox, setBaseBBox] = useState<GeoBBox | null>(null);
  const zoomRef = useRef<ResumableZoomRefType>(null);
  const framedKeyRef = useRef<string>('');
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onUpdate, state } = useTransformationState('common');
  const palette = getMapPalette(themeId);

  const {
    koreaPath,
    provincePaths,
    cityPaths,
    labels,
    graticule,
    pinPositions,
    projection,
    reference,
  } = useMapProjection(size, clusters, baseBBox);

  // How magnified the current base already is vs the full-Korea fit.
  const baseRatio =
    projection && reference ? projection.coeff / reference.coeff : 1;
  // Per-gesture ceiling so chained rebases respect the total zoom budget.
  const maxCameraScale = Math.max(
    REBASE_HEADROOM * 1.05,
    MAX_EFFECTIVE_SCALE / baseRatio,
  );

  const reportEffectiveScale = useCallback(
    (effective: number) => {
      onZoomChange(zoomFromScale(effective));
      onScaleChange?.(effective);
    },
    [onZoomChange, onScaleChange],
  );

  const cancelPendingSettle = () => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  };

  /**
   * Fold the current camera into the base projection. Both sides of the swap
   * paint identical pixels (see utils/rebase.ts), so committing the new SVG
   * and writing the camera in the same task keeps the seam invisible.
   */
  const settle = () => {
    const zr = zoomRef.current;
    if (!zr || !projection || !reference) {
      console.log('[settle] bail: not ready');
      return;
    }
    const current = zr.getState();
    console.log(`[settle] scale=${current.scale.toFixed(3)} ratio=${baseRatio.toFixed(2)}`);
    reportEffectiveScale(baseRatio * current.scale);
    if (Math.abs(current.scale - REBASE_HEADROOM) < SETTLE_EPSILON) {
      return;
    }
    const result = computeRebase({
      visibleRect: zr.getVisibleRect(),
      projection,
      reference,
      viewport: size,
      headroom: REBASE_HEADROOM,
    });
    if (result.type === 'reference') {
      if (baseBBox === null) {
        return; // already on the reference base; the camera is the view
      }
      setBaseBBox(null);
    } else {
      setBaseBBox(result.bbox);
    }
    zr.setTransformState(result.camera, false);
  };

  /**
   * Frame the month's pins: fit against the reference projection, then rebase
   * immediately so the framed view starts sharp, with a short glide into place.
   */
  const frameMonth = () => {
    const zr = zoomRef.current;
    if (!zr || !reference || size.width === 0 || size.height === 0) {
      return;
    }
    cancelPendingSettle();
    const pins = clusters.map((cluster) => {
      const [x, y] = reference.project([cluster.centerLng, cluster.centerLat]);
      return { x, y };
    });
    const fit = fitPinsCamera(pins, size.width, size.height, {
      minScale: MIN_SCALE,
      maxScale: MAX_EFFECTIVE_SCALE,
      maxFitScale: MAX_FIT_SCALE,
      minFitScale: MIN_FIT_SCALE,
    });
    const result = computeRebase({
      visibleRect: visibleRectForCamera(fit, size),
      projection: reference,
      reference,
      viewport: size,
      headroom: REBASE_HEADROOM,
    });
    if (result.type === 'reference') {
      setBaseBBox(null);
      zr.setTransformState(result.camera, false);
    } else {
      setBaseBBox(result.bbox);
      // Entry motion: start slightly deeper and glide out into place. Stays
      // within the new base, so it can never fight the rebase math.
      zr.setTransformState(
        { scale: REBASE_HEADROOM * 1.22, translateX: 0, translateY: 0 },
        false,
      );
      zr.setTransformState(result.camera, true);
    }
    // fit.scale is korea-relative, i.e. already the effective scale.
    reportEffectiveScale(fit.scale);
  };

  useEffect(() => {
    if (size.width === 0 || size.height === 0) {
      return;
    }
    // Wait for pins to land before framing, or the fit would run on an empty set.
    if (pinPositions.length === 0) {
      return;
    }
    // Frame once per month. Not on layout shifts (footer growing after zoom),
    // and not on time-slider filtering — both would snap the camera back to
    // the fit view and read as the map blinking.
    if (frameKey === framedKeyRef.current) {
      return;
    }
    framedKeyRef.current = frameKey;
    const id = requestAnimationFrame(() => {
      frameMonth();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frameKey guards framing; size/pins only gate readiness
  }, [size.width, size.height, frameKey, pinPositions.length]);

  useEffect(() => cancelPendingSettle, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const zoomBy = (factor: number) => {
    const zr = zoomRef.current;
    const current = zr?.getState();
    if (!zr || !current) {
      return;
    }
    const next = Math.min(
      maxCameraScale,
      Math.max(MIN_SCALE, current.scale * factor),
    );
    zr.zoom(next);
    reportEffectiveScale(baseRatio * next);
    cancelPendingSettle();
    settleTimerRef.current = setTimeout(settle, BUTTON_SETTLE_DELAY_MS);
  };

  const resetView = () => {
    frameMonth();
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
              maxScale={maxCameraScale}
              panMode="clamp"
              scaleMode="clamp"
              pinchEnabled
              panEnabled
              tapsEnabled
              allowPinchPanning
              onUpdate={onUpdate}
              onPanStart={cancelPendingSettle}
              onPinchStart={cancelPendingSettle}
              onGestureEnd={settle}
            >
              <View style={{ width: size.width, height: size.height }}>
                {/*
                 * Oversampled by the headroom factor and scaled back down:
                 * the SVG rasterizes at headroom x density, so the settled
                 * camera (scale == headroom) shows it 1:1 crisp.
                 */}
                <View
                  style={{
                    position: 'absolute',
                    left: (size.width - size.width * REBASE_HEADROOM) / 2,
                    top: (size.height - size.height * REBASE_HEADROOM) / 2,
                    width: size.width * REBASE_HEADROOM,
                    height: size.height * REBASE_HEADROOM,
                    transform: [{ scale: 1 / REBASE_HEADROOM }],
                  }}
                >
                  <MapSvg
                    width={size.width}
                    height={size.height}
                    koreaPath={koreaPath}
                    provincePaths={provincePaths}
                    cityPaths={cityPaths}
                    labels={labels}
                    graticule={graticule}
                    resolution={REBASE_HEADROOM}
                    themeId={themeId}
                  />
                </View>
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
