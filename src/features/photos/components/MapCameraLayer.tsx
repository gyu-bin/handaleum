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
 * for an absolute-fill layer. An earlier version re-centered by hand with an
 * extra translate(±center) pair, which double-counted the origin and pushed
 * every marker off by center*(1 - scale) — pins drifted to the top-left corner
 * as the camera zoomed in. Let RN do the centering; do not add it back.
 *
 * Children sit at projected base coordinates (left/top). Wrap markers in a
 * shared inverse-scale Animated style (see MapCanvas) so they stay screen-sized.
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
