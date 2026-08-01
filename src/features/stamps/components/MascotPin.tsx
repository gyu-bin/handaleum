import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

export interface MascotPinProps {
  /** Teardrop height in px. */
  size?: number;
}

/**
 * Cute map-pin mascot: PinGlyph teardrop + face (eyes, smile, blush).
 */
export function MascotPin({ size = 36 }: MascotPinProps) {
  const width = size * (24 / 32);
  return (
    <View style={{ width, height: size }} accessibilityElementsHidden>
      <Svg width={width} height={size} viewBox="0 0 24 32">
        <Path
          d="M12 1 C6 1 1.5 5.6 1.5 11.5 C1.5 19 12 31 12 31 C12 31 22.5 19 22.5 11.5 C22.5 5.6 18 1 12 1 Z"
          fill={theme.colors.accent}
        />
        <Circle cx={12} cy={11} r={6.2} fill={theme.colors.white} />
        <Circle cx={9.6} cy={10.2} r={1.05} fill={theme.colors.ink} />
        <Circle cx={14.4} cy={10.2} r={1.05} fill={theme.colors.ink} />
        <Path
          d="M10.2 13.2 Q12 14.6 13.8 13.2"
          stroke={theme.colors.ink}
          strokeWidth={1.1}
          strokeLinecap="round"
          fill="none"
        />
        <Ellipse
          cx={8.2}
          cy={12.4}
          rx={1.3}
          ry={0.85}
          fill={theme.colors.sand}
          opacity={0.85}
        />
        <Ellipse
          cx={15.8}
          cy={12.4}
          rx={1.3}
          ry={0.85}
          fill={theme.colors.sand}
          opacity={0.85}
        />
      </Svg>
    </View>
  );
}
