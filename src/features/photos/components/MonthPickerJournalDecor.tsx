import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

/** Line-art coastal village — left of the journal header. */
export function JournalCoastSketch({ size = 72 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 0.85} viewBox="0 0 80 68">
      <Path
        d="M4 48 Q20 28 36 40 Q48 22 62 36 Q70 28 78 34"
        stroke={theme.colors.ink}
        strokeWidth={1.4}
        fill="none"
      />
      <Path
        d="M8 50 L8 58 L18 58 L18 44 L12 44 Z"
        stroke={theme.colors.ink}
        strokeWidth={1.2}
        fill="none"
      />
      <Path
        d="M22 52 L22 58 L32 58 L32 46 L26 46 Z"
        stroke={theme.colors.ink}
        strokeWidth={1.2}
        fill="none"
      />
      <Path
        d="M36 48 L36 58 L48 58 L48 42 L40 42 Z"
        stroke={theme.colors.ink}
        strokeWidth={1.2}
        fill="none"
      />
      <Path
        d="M52 50 L52 58 L64 58 L64 46 L56 46 Z"
        stroke={theme.colors.ink}
        strokeWidth={1.2}
        fill="none"
      />
      <Path
        d="M2 58 H78"
        stroke={theme.colors.inkSoft}
        strokeWidth={1}
        fill="none"
      />
      <Path
        d="M6 62 Q20 60 40 63 Q58 66 74 61"
        stroke={theme.colors.accent}
        strokeWidth={1}
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}

/** Circular TRAVEL JOURNAL postmark — right of the journal header. */
export function JournalTravelStamp({ size = 64 }: { size?: number }) {
  return (
    <View style={[styles.stampWrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle
          cx={32}
          cy={32}
          r={29}
          stroke={theme.colors.sand}
          strokeWidth={1.5}
          fill="none"
        />
        <Circle
          cx={32}
          cy={32}
          r={24}
          stroke={theme.colors.sand}
          strokeWidth={1}
          fill="none"
          strokeDasharray="2 2"
        />
        <G transform="translate(32, 22)">
          <Ellipse
            cx={0}
            cy={0}
            rx={10}
            ry={3}
            stroke={theme.colors.sand}
            strokeWidth={1.2}
            fill="none"
          />
          <Path
            d="M-6 0 L8 -4 L6 2 Z"
            stroke={theme.colors.sand}
            strokeWidth={1.2}
            fill="none"
          />
        </G>
        <SvgText
          x={32}
          y={40}
          fill={theme.colors.sand}
          fontSize={5.5}
          fontWeight="700"
          textAnchor="middle"
          letterSpacing={1.2}
        >
          TRAVEL
        </SvgText>
        <SvgText
          x={32}
          y={48}
          fill={theme.colors.sand}
          fontSize={5}
          fontWeight="600"
          textAnchor="middle"
          letterSpacing={0.8}
        >
          JOURNAL
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  stampWrap: {
    transform: [{ rotate: '12deg' }],
    opacity: 0.9,
  },
});
