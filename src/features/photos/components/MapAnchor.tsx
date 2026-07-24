import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

export interface MapCamera {
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

export interface MapAnchorProps {
  /** Base (projected) coordinate in the map's W x H pixel space. */
  x: number;
  y: number;
  /** Canvas size, matching the zoom container. */
  width: number;
  height: number;
  /** Live transform, mirrored from the zoom container. */
  camera: MapCamera;
  interactive?: boolean;
  /**
   * When set, the anchor box is this size centered on the geo point.
   * Needed for Text labels — a 0×0 parent clamps intrinsic Text layout to nothing.
   */
  box?: { width: number; height: number };
  children: ReactNode;
}

/**
 * Positions content over (not inside) the zoom container so it never scales —
 * constant on-screen size. Mirrors ResumableZoom via left/top:
 *   screen = center + translate + scale * (base - center)
 */
export function MapAnchor({
  x,
  y,
  width,
  height,
  camera,
  interactive,
  box,
  children,
}: MapAnchorProps) {
  const boxW = box?.width ?? 0;
  const boxH = box?.height ?? 0;

  const style = useAnimatedStyle(() => {
    const s = camera.scale.value;
    const cx = width / 2;
    const cy = height / 2;
    const px = cx + camera.translateX.value + s * (x - cx);
    const py = cy + camera.translateY.value + s * (y - cy);
    return {
      left: px - boxW / 2,
      top: py - boxH / 2,
      width: boxW || undefined,
      height: boxH || undefined,
    };
  });

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      collapsable={false}
      style={[box ? styles.boxAnchor : styles.anchor, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
  boxAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
});
