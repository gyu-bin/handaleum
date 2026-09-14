import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

export type TravelStampSize = 'book' | 'grid' | 'hero';

const SIZE_PX: Record<TravelStampSize, number> = {
  book: 104,
  grid: 96,
  hero: 148,
};

/** Limited ink set — passport, not game badges. */
const INK_CYCLE = [
  theme.colors.stampInk,
  theme.colors.stampInkMuted,
  theme.colors.stampWashGangwon,
  theme.colors.stampWashJeolla,
] as const;

export function stampInkForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h + key.charCodeAt(i) * (i + 2)) % INK_CYCLE.length;
  }
  return INK_CYCLE[h]!;
}

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
          d="M48 26 L52 26 L53 46 L55 56 L45 56 L47 46 Z M46 56 L54 56 L54 60 L46 60 Z"
          fill={color}
          opacity={0.9}
        />
      );
    case 1:
      return (
        <Path
          d="M26 58 L42 36 L50 48 L58 40 L74 58 Z"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
          opacity={0.9}
        />
      );
    case 2:
      return (
        <Path
          d="M28 46 Q38 38 48 46 T68 46"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          opacity={0.9}
        />
      );
    case 3:
      return (
        <Path
          d="M50 30 C62 38 64 52 50 64 C36 52 38 38 50 30 Z M50 34 L50 58"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          opacity={0.9}
        />
      );
    default:
      return (
        <Path
          d="M50 32 L53 42 L64 42 L55 48 L58 58 L50 52 L42 58 L45 48 L36 42 L47 42 Z"
          fill={color}
          opacity={0.85}
        />
      );
  }
}

export interface TravelStampProps {
  name: string;
  /** Optional English arc label (시·도). */
  nameEn?: string;
  collected: boolean;
  size?: TravelStampSize;
  ink?: string;
  /** Show brand micro-line under Korean name. */
  brand?: boolean;
}

/**
 * Passport travel seal — outer ring, EN label, landmark glyph, KR name.
 * Empty slots stay faint outlines only.
 */
export function TravelStamp({
  name,
  nameEn,
  collected,
  size = 'book',
  ink: inkProp,
  brand = true,
}: TravelStampProps) {
  const dim = SIZE_PX[size];
  const ink = inkProp ?? stampInkForKey(name);
  const kind = symbolKind(name);
  const short =
    name.length > 5 ? `${name.slice(0, 4)}…` : name;
  const en = (nameEn ?? '').toUpperCase().slice(0, 10);

  if (!collected) {
    return (
      <View
        style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel={name}
      >
        <Svg width={dim} height={dim} viewBox="0 0 100 100">
          <Circle
            cx={50}
            cy={50}
            r={44}
            stroke={theme.colors.stampInkMuted}
            strokeWidth={1.3}
            fill="none"
            opacity={0.28}
          />
          <Circle
            cx={50}
            cy={50}
            r={36}
            stroke={theme.colors.stampInkMuted}
            strokeWidth={0.9}
            fill="none"
            opacity={0.16}
            strokeDasharray="3 4"
          />
        </Svg>
        <View style={styles.emptyLabel} pointerEvents="none">
          <Text style={styles.emptyText} numberOfLines={2}>
            {short}
          </Text>
        </View>
      </View>
    );
  }

  const hero = size === 'hero';
  return (
    <View
      style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={name}
    >
      <Svg width={dim} height={dim} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={46} fill={ink} fillOpacity={0.12} />
        <Circle
          cx={50}
          cy={50}
          r={44}
          stroke={ink}
          strokeWidth={2.8}
          fill="none"
          opacity={0.92}
        />
        <Circle
          cx={50}
          cy={50}
          r={37}
          stroke={ink}
          strokeWidth={1.1}
          fill="none"
          strokeDasharray="2 3"
          opacity={0.45}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 50 + Math.cos(rad) * 40;
          const y1 = 50 + Math.sin(rad) * 40;
          const x2 = 50 + Math.cos(rad) * 43.2;
          const y2 = 50 + Math.sin(rad) * 43.2;
          return (
            <Path
              key={deg}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={ink}
              strokeWidth={1.3}
              strokeLinecap="round"
              opacity={0.45}
            />
          );
        })}
        <SealSymbol kind={kind} color={ink} />
      </Svg>
      <View style={styles.overlay} pointerEvents="none">
        {en ? (
          <Text
            style={[styles.en, { color: ink }, hero && styles.enHero]}
            numberOfLines={1}
          >
            {en}
          </Text>
        ) : (
          <View style={styles.enSpacer} />
        )}
        <View style={styles.midSpacer} />
        <Text
          style={[styles.ko, { color: ink }, hero && styles.koHero]}
          numberOfLines={2}
        >
          {short}
        </Text>
        {brand ? (
          <Text style={[styles.brand, { color: ink }]} numberOfLines={1}>
            HANDALEUM
          </Text>
        ) : (
          <View style={styles.brandSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    paddingTop: '14%',
    paddingBottom: '11%',
    paddingHorizontal: 10,
  },
  en: {
    fontFamily: theme.fonts.sans,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    opacity: 0.85,
  },
  enHero: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.4,
  },
  enSpacer: {
    height: 10,
  },
  midSpacer: {
    flex: 1,
  },
  ko: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  koHero: {
    fontSize: 18,
    lineHeight: 22,
  },
  brand: {
    fontFamily: theme.fonts.sans,
    fontSize: 6,
    lineHeight: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 2,
    opacity: 0.55,
  },
  brandSpacer: {
    height: 8,
  },
  emptyLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.stampInkMuted,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.45,
  },
});
