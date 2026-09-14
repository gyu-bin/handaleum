import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

function symbolKind(name: string): 0 | 1 | 2 | 3 | 4 {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 3)) % 5;
  }
  return h as 0 | 1 | 2 | 3 | 4;
}

function SealSymbol({ kind, color }: { kind: 0 | 1 | 2 | 3 | 4; color: string }) {
  switch (kind) {
    case 0:
      return (
        <Path
          d="M48 28 L52 28 L53 48 L55 58 L45 58 L47 48 Z M46 58 L54 58 L54 62 L46 62 Z"
          fill={color}
          opacity={0.85}
        />
      );
    case 1:
      return (
        <Path
          d="M28 60 L42 38 L50 50 L58 42 L72 60 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
          opacity={0.85}
        />
      );
    case 2:
      return (
        <Path
          d="M28 48 Q38 40 48 48 T68 48"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.85}
        />
      );
    case 3:
      return (
        <Path
          d="M50 32 C62 40 64 54 50 66 C36 54 38 40 50 32 Z M50 36 L50 60"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          opacity={0.85}
        />
      );
    default:
      return (
        <Path
          d="M50 34 L53 44 L64 44 L55 50 L58 60 L50 54 L42 60 L45 50 L36 44 L47 44 Z"
          fill={color}
          opacity={0.8}
        />
      );
  }
}

/** Empty passport slot — faint outline, low visual priority. */
export function EmptySeat({ name, hero }: { name: string; hero: boolean }) {
  const dim = hero ? 120 : 96;
  const short = name.length > 5 ? `${name.slice(0, 4)}…` : name;
  return (
    <View style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={dim} height={dim} viewBox="0 0 100 100">
        <Circle
          cx={50}
          cy={50}
          r={44}
          stroke={theme.colors.stampInkMuted}
          strokeWidth={1.4}
          fill="none"
          opacity={0.35}
        />
        <Circle
          cx={50}
          cy={50}
          r={36}
          stroke={theme.colors.stampInkMuted}
          strokeWidth={0.9}
          fill="none"
          opacity={0.22}
          strokeDasharray="3 4"
        />
      </Svg>
      <View style={styles.nameOverlay} pointerEvents="none">
        <Text style={styles.emptyName} numberOfLines={2}>
          {short}
        </Text>
      </View>
    </View>
  );
}

/** Collected rubber seal — slate navy ink + tiny landmark glyph. */
export function SealFace({ name, hero }: { name: string; hero: boolean }) {
  const dim = hero ? 120 : 96;
  const short = name.length > 5 ? name.slice(0, 5) : name;
  const kind = symbolKind(name);
  const ink = theme.colors.stampInk;
  return (
    <View style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={dim} height={dim} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={46} fill={theme.colors.stampInkWash} />
        <Circle
          cx={50}
          cy={50}
          r={44}
          stroke={ink}
          strokeWidth={3.4}
          fill="none"
          opacity={0.92}
        />
        <Circle
          cx={50}
          cy={50}
          r={37}
          stroke={theme.colors.stampInkMuted}
          strokeWidth={1.3}
          fill="none"
          strokeDasharray="2.2 3.2"
          opacity={0.75}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 50 + Math.cos(rad) * 40;
          const y1 = 50 + Math.sin(rad) * 40;
          const x2 = 50 + Math.cos(rad) * 43.5;
          const y2 = 50 + Math.sin(rad) * 43.5;
          return (
            <Path
              key={deg}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={ink}
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.55}
            />
          );
        })}
        <SealSymbol kind={kind} color={ink} />
      </Svg>
      <View style={styles.nameOverlay} pointerEvents="none">
        <Text
          style={[styles.sealText, hero && styles.sealTextHero]}
          numberOfLines={2}
        >
          {short}
        </Text>
      </View>
    </View>
  );
}

/**
 * Compact passport seal for the nation board map — region wash fill + ink rings.
 */
export function BoardSealMark({
  name,
  visited,
  fill,
  size = 44,
}: {
  name: string;
  visited: boolean;
  fill: string;
  size?: number;
}) {
  const short = name.length > 2 ? name.slice(0, 2) : name;
  const kind = symbolKind(name);
  const ink = theme.colors.stampInk;
  if (!visited) {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle
            cx={50}
            cy={50}
            r={44}
            stroke={theme.colors.stampInkMuted}
            strokeWidth={1.6}
            fill="none"
            opacity={0.32}
          />
          <Circle
            cx={50}
            cy={50}
            r={34}
            stroke={theme.colors.stampInkMuted}
            strokeWidth={1}
            fill="none"
            opacity={0.2}
            strokeDasharray="3 4"
          />
        </Svg>
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={46} fill={fill} />
        <Circle
          cx={50}
          cy={50}
          r={44}
          stroke={ink}
          strokeWidth={3.2}
          fill="none"
          opacity={0.88}
        />
        <Circle
          cx={50}
          cy={50}
          r={36}
          stroke={ink}
          strokeWidth={1.2}
          fill="none"
          strokeDasharray="2.2 3.2"
          opacity={0.55}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 50 + Math.cos(rad) * 39;
          const y1 = 50 + Math.sin(rad) * 39;
          const x2 = 50 + Math.cos(rad) * 43;
          const y2 = 50 + Math.sin(rad) * 43;
          return (
            <Path
              key={deg}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={ink}
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0.5}
            />
          );
        })}
        <SealSymbol kind={kind} color={ink} />
      </Svg>
      <View style={styles.boardNameOverlay} pointerEvents="none">
        <Text style={styles.boardSealText} numberOfLines={1}>
          {short}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: '22%',
  },
  sealText: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 15,
    color: theme.colors.stampInk,
    fontWeight: '700',
    textAlign: 'center',
  },
  sealTextHero: {
    fontSize: 17,
    lineHeight: 20,
  },
  emptyName: {
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.stampInkMuted,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.55,
  },
  boardNameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: '18%',
  },
  boardSealText: {
    fontFamily: theme.fonts.sans,
    fontSize: 10,
    lineHeight: 12,
    color: theme.colors.stampInk,
    fontWeight: '800',
    textAlign: 'center',
  },
});
