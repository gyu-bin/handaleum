import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { useClusterPlaceLabels } from '../hooks/useClusterPlaceLabels';
import type { MapThemeId, PlaceCluster } from '../types';
import { fitPinsCamera, type MapCameraTransform } from '../utils/fitPinsCamera';
import type { GeoBBox } from '../utils/geo';
import { placeBucketKey } from '../utils/placeJourney';
import { computeRebase, visibleRectForCamera } from '../utils/rebase';
import { ClusterPin } from './ClusterPin';
import { MapCameraLayer } from './MapCameraLayer';
import { MapFloatingLabel, MapPlaceStamp, labelBoxSize, stampBoxSize } from './MapFloatingLabel';
import { MapSvg, type MapDetail } from './MapSvg';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_FIT_SCALE = 5;
const MIN_FIT_SCALE = 1.6;
const ZOOM_STEP = 1.55;

/**
 * Total zoom budget relative to the full-Korea view. Rebase re-projects at each
 * settle, so the map stays crisp all the way in; this just sets how deep a user
 * can go (≈ Korea's ~400km width / this = smallest visible span, so 60 ≈ a few
 * km across — neighborhood level, enough to pull nearby pins apart). The
 * camera's per-gesture maxScale is derived from this so chained rebases can
 * never exceed it.
 */
const MAX_EFFECTIVE_SCALE = 60;

/**
 * Zoom-out allowance of a rebased base: the settled camera sits at this scale
 * over a base drawn for headroom x the visible region, so a pinch-out has room
 * before hitting the camera floor of 1.
 */
const REBASE_HEADROOM = 2;

/** |cameraScale - headroom| below this counts as no zoom change. */
const SETTLE_EPSILON = 0.02;

/**
 * When the camera is still near the settled headroom scale, only rebase once
 * the visible rect has used this fraction of its size as edge cushion. Skipping
 * mid-margin pans avoids an SVG rebuild after every fling (the main scroll hitch).
 */
const PAN_EDGE_FRACTION = 0.18;

/** Zoom buttons animate internally; settle after the motion has finished. */
const BUTTON_SETTLE_DELAY_MS = 420;

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
  /**
   * Bumped on every rebase request. The camera reset is applied in a layout
   * effect keyed on this, i.e. AFTER the new base SVG has committed — otherwise
   * the imperative camera write lands before the re-render and the old SVG is
   * briefly shown at the new camera, which reads as the map popping to a
   * different place and back.
   */
  const [rebaseSeq, setRebaseSeq] = useState(0);
  const pendingCameraRef = useRef<{
    camera: MapCameraTransform;
    /** Optional snap-to scale before animating, for the framing entry motion. */
    from?: number;
    animate: boolean;
  } | null>(null);
  const zoomRef = useRef<ResumableZoomRefType>(null);
  const framedKeyRef = useRef<string>('');
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onUpdate, state } = useTransformationState('common');
  const palette = getMapPalette(themeId);
  /**
   * Floating labels each own a Reanimated anchor. Hide them for the whole
   * gesture (including decay) so pan/pinch only moves the SVG + pins.
   */
  const [labelsLive, setLabelsLive] = useState(true);

  // Shared inverse scale — one worklet for every pin/label, not one per marker.
  const constantSizeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 / Math.max(state.scale.value, 0.05) }],
  }));

  // Detail from rebased coverage: overview (full KR) → region (도/시) → local (구 stamps).
  const detail: MapDetail = useMemo(() => {
    if (baseBBox === null) {
      return 'overview';
    }
    const lngSpan = baseBBox.maxLng - baseBBox.minLng;
    const latSpan = baseBBox.maxLat - baseBBox.minLat;
    return lngSpan < 1.2 || latSpan < 1.0 ? 'local' : 'region';
  }, [baseBBox]);

  const {
    koreaPath,
    provincePaths,
    cityPaths,
    districtPaths,
    labels,
    pinPositions,
    projection,
    reference,
  } = useMapProjection(size, clusters, baseBBox, detail);

  const placeLabels = useClusterPlaceLabels(clusters, detail === 'local');

  const placeStamps = useMemo(() => {
    if (!projection || detail !== 'local' || placeLabels.length === 0) {
      return [];
    }
    // Skip stamp when a district centroid label already shows the same 구.
    const labeled = new Set(labels.map((label) => label.text));
    return placeLabels
      .filter((label) => !labeled.has(label.text))
      .map((label) => {
        const [x, y] = projection.project([label.lng, label.lat]);
        return {
          key: label.clusterId,
          text: label.text,
          x,
          y,
        };
      });
  }, [detail, labels, placeLabels, projection]);

  // Full-Korea view: seat journal sketch marks in the projected focus frame.
  const landRect =
    projection && baseBBox === null
      ? (() => {
          const { minLng, maxLng, minLat, maxLat } = projection.bbox;
          const [x0, y0] = projection.project([minLng, maxLat]);
          const [x1, y1] = projection.project([maxLng, minLat]);
          return {
            x: Math.min(x0, x1),
            y: Math.min(y0, y1),
            width: Math.abs(x1 - x0),
            height: Math.abs(y1 - y0),
          };
        })()
      : null;

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

  const cancelPendingLabels = () => {
    if (labelsTimerRef.current !== null) {
      clearTimeout(labelsTimerRef.current);
      labelsTimerRef.current = null;
    }
  };

  /** Bring labels back after inertia has mostly settled. */
  const restoreLabelsSoon = () => {
    cancelPendingLabels();
    labelsTimerRef.current = setTimeout(() => {
      labelsTimerRef.current = null;
      setLabelsLive(true);
    }, 260);
  };

  const beginGesture = () => {
    cancelPendingSettle();
    cancelPendingLabels();
    setLabelsLive(false);
  };

  /**
   * Queue a base swap. The base state changes now; the camera is applied in the
   * layout effect below, after the new SVG commits, so the two land together
   * instead of the camera jumping a few frames ahead of the re-render.
   */
  const scheduleRebase = (
    nextBase: GeoBBox | null,
    camera: MapCameraTransform,
    opts?: { from?: number; animate?: boolean },
  ) => {
    pendingCameraRef.current = {
      camera,
      from: opts?.from,
      animate: opts?.animate ?? false,
    };
    setBaseBBox(nextBase);
    setRebaseSeq((seq) => seq + 1);
  };

  /**
   * Fold the current camera into the base projection. Both sides of the swap
   * paint identical pixels (see utils/rebase.ts); scheduleRebase then keeps the
   * base commit and the camera reset on the same frame so the seam is invisible.
   *
   * Skip when a rebase would not change coverage — every unnecessary swap
   * rebuilds the Korea SVG and reads as a hitch at the end of a fling/pinch.
   */
  const settle = () => {
    try {
      const zr = zoomRef.current;
      if (!zr || !projection || !reference) {
        return;
      }
      const current = zr.getState();
      reportEffectiveScale(baseRatio * current.scale);

      const visible = zr.getVisibleRect();
      const zoomSettled =
        Math.abs(current.scale - REBASE_HEADROOM) < SETTLE_EPSILON;

      if (baseBBox === null) {
        // Full Korea: nothing to sharpen until past the headroom band.
        if (current.scale < REBASE_HEADROOM + SETTLE_EPSILON) {
          return;
        }
      } else if (zoomSettled) {
        const edgePad =
          Math.min(visible.width, visible.height) * PAN_EDGE_FRACTION;
        const nearEdge =
          visible.x < edgePad ||
          visible.y < edgePad ||
          visible.x + visible.width > size.width - edgePad ||
          visible.y + visible.height > size.height - edgePad;
        if (!nearEdge) {
          return;
        }
      }

      const result = computeRebase({
        visibleRect: visible,
        projection,
        reference,
        viewport: size,
        headroom: REBASE_HEADROOM,
      });
      if (result.type === 'reference') {
        if (baseBBox === null) {
          return; // already on the reference base; the camera is the view
        }
        scheduleRebase(null, result.camera);
      } else {
        scheduleRebase(result.bbox, result.camera);
      }
    } finally {
      // After finger-up + any rebase decision, bring labels back once fling cools.
      restoreLabelsSoon();
    }
  };

  // Apply the queued camera right after the new base SVG commits.
  useLayoutEffect(() => {
    const pending = pendingCameraRef.current;
    const zr = zoomRef.current;
    if (!pending || !zr) {
      return;
    }
    pendingCameraRef.current = null;
    if (pending.from !== undefined) {
      zr.setTransformState(
        { scale: pending.from, translateX: 0, translateY: 0 },
        false,
      );
    }
    zr.setTransformState(pending.camera, pending.animate);
  }, [rebaseSeq]);

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
      scheduleRebase(null, result.camera);
    } else {
      // Entry motion: start slightly deeper and glide out into place. Stays
      // within the new base, so it can never fight the rebase math.
      scheduleRebase(result.bbox, result.camera, {
        from: REBASE_HEADROOM * 1.22,
        animate: true,
      });
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
  useEffect(() => () => cancelPendingLabels(), []);

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
            backgroundColor: palette.water,
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
              // friction / bounce: rubber-band at edges instead of a hard stop.
              panMode="friction"
              scaleMode="bounce"
              // Inertia after release (default true — keep explicit).
              decay
              pinchEnabled
              panEnabled
              tapsEnabled
              allowPinchPanning
              onUpdate={onUpdate}
              onPanStart={beginGesture}
              onPinchStart={beginGesture}
              onGestureEnd={settle}
            >
              <View style={{ width: size.width, height: size.height }}>
                {/*
                 * Rendered 1:1 — no raster oversampling. react-native-svg
                 * re-rasterizes the vector paths crisply at the composited
                 * scale, and rebase keeps the settled camera low (~headroom),
                 * so the map stays sharp at every depth.
                 */}
                <MapSvg
                  width={size.width}
                  height={size.height}
                  koreaPath={koreaPath}
                  provincePaths={provincePaths}
                  cityPaths={cityPaths}
                  districtPaths={districtPaths}
                  themeId={themeId}
                  detail={detail}
                  landRect={landRect}
                />
              </View>
            </ResumableZoom>

            <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
              <MapCameraLayer
                width={size.width}
                height={size.height}
                camera={state}
              >
                {labelsLive
                  ? labels.map((label) => {
                      if (detail === 'overview' && label.tier > 1) {
                        return null;
                      }
                      const box = labelBoxSize(label.text, label.tier);
                      return (
                        <View
                          key={label.key}
                          pointerEvents="none"
                          style={[
                            styles.mapPoint,
                            { left: label.x, top: label.y },
                          ]}
                        >
                          <Animated.View
                            style={[
                              constantSizeStyle,
                              {
                                width: box.width,
                                height: box.height,
                                marginLeft: -box.width / 2,
                                marginTop: -box.height / 2,
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                            ]}
                          >
                            <MapFloatingLabel
                              text={label.text}
                              tier={label.tier}
                              detail={detail}
                              palette={palette}
                            />
                          </Animated.View>
                        </View>
                      );
                    })
                  : null}
                {labelsLive
                  ? placeStamps.map((stamp) => {
                      const box = stampBoxSize(stamp.text);
                      return (
                        <View
                          key={`stamp-${stamp.key}`}
                          pointerEvents="none"
                          style={[
                            styles.mapPoint,
                            { left: stamp.x, top: stamp.y },
                          ]}
                        >
                          <Animated.View
                            style={[
                              constantSizeStyle,
                              {
                                width: box.width,
                                height: box.height,
                                marginLeft: -box.width / 2,
                                marginTop: -4,
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                            ]}
                          >
                            <MapPlaceStamp text={stamp.text} />
                          </Animated.View>
                        </View>
                      );
                    })
                  : null}
                {pinPositions.map(({ cluster, x, y }) => {
                  const placeKey = placeBucketKey(
                    cluster.centerLat,
                    cluster.centerLng,
                  );
                  return (
                    <View
                      key={cluster.id}
                      pointerEvents="box-none"
                      style={[styles.mapPoint, { left: x, top: y }]}
                    >
                      <Animated.View style={constantSizeStyle}>
                        <ClusterPin
                          cluster={cluster}
                          selected={selectedClusterId === cluster.id}
                          onPress={onSelectCluster}
                          coverAssetId={pinCovers[placeKey]}
                        />
                      </Animated.View>
                    </View>
                  );
                })}
              </MapCameraLayer>
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
    borderRadius: 0,
  },
  overlay: {
    zIndex: 1,
  },
  mapPoint: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
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
