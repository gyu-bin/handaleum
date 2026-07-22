import Svg, { Circle, Path } from 'react-native-svg';

import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { theme } from '@/shared/constants/theme';

export interface BrandMarkProps {
  /** Rendered height in px; width follows the silhouette aspect ratio. */
  height: number;
  /** Silhouette fill (defaults to the dawn accent). */
  color?: string;
}

/**
 * The app's map silhouette (South Korea, mainland + Jeju). Static SVG shared by
 * the splash, the loading screen, and — later — the app icon, so the identity
 * is one shape everywhere. Pins/ripples are layered on top by the caller (see
 * `pinOffset` for the Seoul anchor).
 */
export function BrandMark({ height, color = theme.colors.accent }: BrandMarkProps) {
  const width = height * KOREA_SILHOUETTE.aspect;
  return (
    <Svg width={width} height={height} viewBox={KOREA_SILHOUETTE.viewBox}>
      <Path d={KOREA_SILHOUETTE.path} fill={color} />
    </Svg>
  );
}

/** Seoul anchor (pin tip) for a BrandMark of the given height, in px from top-left. */
export function pinOffset(height: number): { x: number; y: number } {
  const width = height * KOREA_SILHOUETTE.aspect;
  return {
    x: width * KOREA_SILHOUETTE.pin.fx,
    y: height * KOREA_SILHOUETTE.pin.fy,
  };
}

export interface PinGlyphProps {
  /** Height of the teardrop in px; the tip sits at the bottom-center. */
  size: number;
  color?: string;
  dotColor?: string;
}

/** Classic map pin (teardrop). Tip is at the bottom-center for anchoring. */
export function PinGlyph({
  size,
  color = theme.colors.sand,
  dotColor = theme.colors.white,
}: PinGlyphProps) {
  const width = size * (24 / 32);
  return (
    <Svg width={width} height={size} viewBox="0 0 24 32">
      <Path
        d="M12 1 C6 1 1.5 5.6 1.5 11.5 C1.5 19 12 31 12 31 C12 31 22.5 19 22.5 11.5 C22.5 5.6 18 1 12 1 Z"
        fill={color}
      />
      <Circle cx={12} cy={11.5} r={4} fill={dotColor} />
    </Svg>
  );
}
