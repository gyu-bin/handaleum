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
 * One animated layer that mirrors ResumableZoom's camera:
 *   screen = center + translate + scale * (base - center)
 *
 * Children sit at projected base coordinates. Wrap markers in a shared
 * inverse-scale Animated style (see MapCanvas) so they stay screen-sized.
 */
export function MapCameraLayer({
  width,
  height,
  camera,
  children,
}: {
  width: number;
  height: number;
  camera: MapCamera;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const s = camera.scale.value;
    const cx = width / 2;
    const cy = height / 2;
    return {
      transform: [
        { translateX: cx + camera.translateX.value },
        { translateY: cy + camera.translateY.value },
        { scale: s },
        { translateX: -cx },
        { translateY: -cy },
      ],
    };
  });

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
