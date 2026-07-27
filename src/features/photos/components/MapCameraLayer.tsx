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

/**
 * One animated layer that mirrors ResumableZoom's camera so children pinned at
 * projected base coordinates track the map at every zoom.
 *
 * The transform is deliberately identical in shape to the zoom library's own
 * child transform — `[translateX, translateY, scale]` — because React Native
 * applies a view's transform about its CENTER (transformOrigin defaults to
 * 50% 50%). That built-in centering already yields
 *   screen = center + translate + scale * (base - center)
 * for an absolute-fill layer.
 *
 * Children sit at projected base coordinates (left/top). Wrap photo pins in a
 * shared inverse-scale Animated style (see MapCanvas) so they stay screen-sized.
 * Prefer {@link MapScreenAnchor} for Text — inverse-scale blurs glyphs.
 */
export function MapCameraLayer({
  camera,
  children,
}: {
  camera: MapCamera;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: camera.translateX.value },
      { translateY: camera.translateY.value },
      { scale: camera.scale.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      collapsable={false}
      style={[StyleSheet.absoluteFill, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Places a child at the screen projection of a base map point WITHOUT scaling
 * the child. Text stays crisp at every zoom.
 */
export function MapScreenAnchor({
  camera,
  baseX,
  baseY,
  viewportW,
  viewportH,
  children,
}: {
  camera: MapCamera;
  baseX: number;
  baseY: number;
  viewportW: number;
  viewportH: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const cx = viewportW / 2;
    const cy = viewportH / 2;
    const s = camera.scale.value;
    // Integer pixels — fractional left/top makes Text AA shimmer every frame.
    const x = Math.round(cx + camera.translateX.value + s * (baseX - cx));
    const y = Math.round(cy + camera.translateY.value + s * (baseY - cy));
    return {
      position: 'absolute' as const,
      left: x,
      top: y,
    };
  });

  return (
    <Animated.View pointerEvents="none" collapsable={false} style={style}>
      {children}
    </Animated.View>
  );
}
