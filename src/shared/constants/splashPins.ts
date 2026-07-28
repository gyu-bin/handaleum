import type { ImageSourcePropType } from 'react-native';

import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';

/** Shared map height for splash ↔ loading handoff. */
export const SPLASH_MAP_H = 304;

/**
 * Polaroid stamp pin geometry — tip sits at the city coordinate on the map.
 * Kept as plain numbers so callers can share layout with LoadingView / splash.
 */
export const SPLASH_STAMP = {
  photo: 38,
  padX: 3,
  padTop: 3,
  padBottom: 14,
  tailH: 10,
  tailW: 12,
  frameW: 44,
  frameH: 55,
  /** frameH + tailH — height from frame top to tip. */
  totalH: 65,
} as const;

/**
 * City photo thumbnails for splash / loading stamp pins (sample A polaroid).
 * Keys match `KOREA_SILHOUETTE.pins[].name`.
 */
export const SPLASH_PIN_IMAGES: Record<
  (typeof KOREA_SILHOUETTE.pins)[number]['name'],
  ImageSourcePropType
> = {
  서울: require('../../../assets/splash/pins/seoul.png'),
  강릉: require('../../../assets/splash/pins/gangneung.png'),
  부산: require('../../../assets/splash/pins/busan.png'),
  광주: require('../../../assets/splash/pins/gwangju.png'),
  제주: require('../../../assets/splash/pins/jeju.png'),
};

/** Subtle stamp tilt per city (degrees), matching the sample A layout. */
export const SPLASH_PIN_TILT: Record<
  (typeof KOREA_SILHOUETTE.pins)[number]['name'],
  number
> = {
  서울: -5,
  강릉: 4,
  부산: 6,
  광주: -3,
  제주: 5,
};
