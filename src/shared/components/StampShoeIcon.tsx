import Svg, { G, Path } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

export interface StampShoeIconProps {
  size?: number;
  color?: string;
  /** Soft fill when tab/gate is active. */
  active?: boolean;
}

/**
 * Single sole — sized so a pair fits the 24 viewBox with stroke margin.
 */
const SOLE =
  'M2.4 1.8c.7-1.1 2.3-1.7 3.8-1.4 1.6.3 2.6 1.4 2.8 2.9.3 1.9-.2 3.8-1.2 5.3L6.6 10.6c-.7.9-1.9 1.3-3 1-.9-.2-1.6-1-1.7-1.9C1.6 7.4 1.8 4.2 2.4 1.8Z';

const TREAD = 'M3.5 4.2h2.8M3.3 6.2h3.2';

/**
 * S4 — pair of shoe soles (kept for swap-back; nav uses StampSneakerIcon).
 * Stays inside the 24 viewBox (no overflow/clip).
 * Stroke scales with `size` so screen weight matches other 22px nav icons (~1.6).
 */
export function StampShoeIcon({
  size = 22,
  color = theme.colors.ink,
  active = false,
}: StampShoeIconProps) {
  const stroke = (1.6 * 22) / size;
  const tread = stroke * 0.72;
  const fillOpacity = active ? 0.14 : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Left sole */}
      <G transform="translate(3.2, 4.5) rotate(-14, 4.5, 6.5)">
        <Path
          d={SOLE}
          stroke={color}
          strokeWidth={stroke}
          strokeLinejoin="round"
          fill={active ? color : 'none'}
          fillOpacity={fillOpacity}
        />
        <Path
          d={TREAD}
          stroke={color}
          strokeWidth={tread}
          strokeLinecap="round"
          opacity={0.5}
        />
      </G>
      {/* Right sole */}
      <G transform="translate(11.8, 6.2) rotate(12, 4.5, 6.5)">
        <Path
          d={SOLE}
          stroke={color}
          strokeWidth={stroke}
          strokeLinejoin="round"
          fill={active ? color : 'none'}
          fillOpacity={fillOpacity}
        />
        <Path
          d={TREAD}
          stroke={color}
          strokeWidth={tread}
          strokeLinecap="round"
          opacity={0.5}
        />
      </G>
    </Svg>
  );
}
