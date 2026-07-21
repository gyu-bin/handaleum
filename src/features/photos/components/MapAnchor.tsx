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
  children,
}: MapAnchorProps) {
  const style = useAnimatedStyle(() => {
    const s = camera.scale.value;
    const cx = width / 2;
    const cy = height / 2;
    // Drive position with transform, not left/top: layout props animate on the
    // layout path (a Yoga pass per pin per frame), which stutters the whole
    // canvas during pan/zoom. translate composites on the UI thread with no
    // layout. The 0x0 anchor still centers its child on (tx, ty).
    const tx = cx + camera.translateX.value + s * (x - cx);
    const ty = cy + camera.translateY.value + s * (y - cy);
    return { transform: [{ translateX: tx }, { translateY: ty }] };
  });

  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.anchor, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    // Fixed transform origin so translateX/Y map to absolute canvas coords.
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
