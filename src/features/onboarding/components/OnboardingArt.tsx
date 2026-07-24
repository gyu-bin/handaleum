import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { BrandMark, PinGlyph } from '@/shared/components/BrandMark';
import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { theme } from '@/shared/constants/theme';

const LOOP = ReduceMotion.Never;

function clamp01(v: number): number {
  'worklet';
  return Math.max(0, Math.min(1, v));
}

/* ── Slide 1 — map settles, then pins "write" on one by one (like CardArt) ── */

const MAP_H = 248;
const PIN_H = 26;
const PIN_W = PIN_H * (24 / 32);
const DROP = 22;
const STAMP_CITIES = KOREA_SILHOUETTE.pins; // 서울→강릉→부산→광주→제주
/** Same loop rhythm as CardArt: build → hold → soft clear. */
const CYCLE_MS = 4200;

/** Quiet paper silhouette: warm land, soft ink edge, tiny offset shadow. */
function PaperKorea({ height }: { height: number }) {
  const width = height * KOREA_SILHOUETTE.aspect;
  const d = KOREA_SILHOUETTE.path;
  return (
    <Svg width={width} height={height} viewBox={KOREA_SILHOUETTE.viewBox}>
      <Path d={d} fill={theme.tint.faint} transform="translate(0.9, 1.1)" />
      <Path d={d} fill={theme.colors.land} />
      <Path
        d={d}
        fill="none"
        stroke={theme.colors.accent}
        strokeWidth={0.7}
        opacity={0.28}
      />
    </Svg>
  );
}

function StampPin({
  cycle,
  x,
  y,
  order,
}: {
  cycle: SharedValue<number>;
  x: number;
  y: number;
  order: number;
}) {
  // After the map settles (~0.16), pins write in like CardArt skeleton lines.
  const dropStart = 0.18 + order * 0.1;
  const dropDur = 0.12;

  const pinStyle = useAnimatedStyle(() => {
    const wp = clamp01((cycle.value - dropStart) / dropDur);
    const ep = clamp01((cycle.value - 0.86) / 0.12);
    const eased = 1 - (1 - wp) * (1 - wp) * (1 - wp);
    return {
      opacity: Math.min(1, eased * 4) * (1 - ep),
      transform: [{ translateY: (eased - 1) * DROP }],
    };
  });

  return (
    <Animated.View
      style={[styles.pin, { left: x - PIN_W / 2, top: y - PIN_H }, pinStyle]}
    >
      <PinGlyph size={PIN_H} />
    </Animated.View>
  );
}

export function MapPinArt() {
  const width = MAP_H * KOREA_SILHOUETTE.aspect;
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = withRepeat(
      withTiming(1, {
        duration: CYCLE_MS,
        easing: Easing.linear,
        reduceMotion: LOOP,
      }),
      -1,
      false,
      undefined,
      LOOP,
    );
    return () => {
      cancelAnimation(cycle);
    };
  }, [cycle]);

  // Map arrives first — same "page fills in" beat as the card photo/frame.
  const mapStyle = useAnimatedStyle(() => {
    const inP = clamp01(cycle.value / 0.16);
    const ep = clamp01((cycle.value - 0.9) / 0.08);
    const eased = 1 - (1 - inP) * (1 - inP);
    return {
      opacity: (0.2 + eased * 0.8) * (1 - ep * 0.35),
      transform: [{ translateY: (1 - eased) * 10 }],
    };
  });

  return (
    <View style={[styles.mapStage, { width, height: MAP_H }]}>
      <Animated.View style={mapStyle}>
        <PaperKorea height={MAP_H} />
      </Animated.View>
      {STAMP_CITIES.map((c, i) => (
        <StampPin
          key={c.name}
          cycle={cycle}
          x={c.fx * width}
          y={c.fy * MAP_H}
          order={i}
        />
      ))}
    </View>
  );
}

/* ── Slide 2 — skeleton text writes itself into the card ──────────────────── */

const CARD_W = 158;
const CARD_H = 198;
const CARD_PAD = 14;
const INNER_W = CARD_W - CARD_PAD * 2;
const WRITE_MS = 3600;
const LINE_FULL = [INNER_W, INNER_W * 0.82, INNER_W * 0.92, INNER_W * 0.55];

function WriteLine({
  cycle,
  full,
  order,
}: {
  cycle: SharedValue<number>;
  full: number;
  order: number;
}) {
  const wStart = 0.12 + order * 0.15;
  const wDur = 0.2;
  const style = useAnimatedStyle(() => {
    const wp = clamp01((cycle.value - wStart) / wDur);
    const ep = clamp01((cycle.value - 0.84) / 0.14);
    // Keep a hair of width so the card never looks empty mid-loop.
    return { width: Math.max(full * 0.08, full * wp * (1 - ep * 0.92)) };
  });
  return <Animated.View style={[styles.line, style]} />;
}

export function CardArt() {
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = withRepeat(
      withTiming(1, {
        duration: WRITE_MS,
        easing: Easing.linear,
        reduceMotion: LOOP,
      }),
      -1,
      false,
      undefined,
      LOOP,
    );
    return () => {
      cancelAnimation(cycle);
    };
  }, [cycle]);

  return (
    <View style={styles.cardStage}>
      <View style={styles.cardBack} />
      <View style={styles.cardFront}>
        <View style={styles.cardPhoto} />
        <View style={styles.cardLines}>
          {LINE_FULL.map((full, i) => (
            <WriteLine key={i} cycle={cycle} full={full} order={i} />
          ))}
        </View>
      </View>
    </View>
  );
}

/* ── Slide 3 — breathing disc with staggered sonar rings ──────────────────── */

const CIRCLE = 184;
const DISC = 156;
const PULSE_MS = 2600;

function SonarRing({ delay }: { delay: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: PULSE_MS,
          easing: Easing.out(Easing.cubic),
          reduceMotion: LOOP,
        }),
        -1,
        false,
        undefined,
        LOOP,
      ),
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [delay, pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.34 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.3 }],
  }));

  return <Animated.View style={[styles.pulseRing, style]} />;
}

export function AccessArt() {
  const breathe = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, {
        duration: PULSE_MS,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: LOOP,
      }),
      -1,
      true,
      undefined,
      LOOP,
    );
    return () => {
      cancelAnimation(breathe);
    };
  }, [breathe]);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breathe.value * 0.03 }],
  }));

  return (
    <View style={styles.discStage}>
      <SonarRing delay={0} />
      <SonarRing delay={PULSE_MS / 2} />
      <Animated.View style={[styles.disc, discStyle]}>
        <BrandMark height={118} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    position: 'absolute',
    ...theme.shadows.card,
  },
  cardStage: {
    width: CARD_W + 40,
    height: CARD_H + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBack: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceAlt,
    transform: [{ rotate: '-7deg' }, { translateX: -10 }],
    opacity: 0.7,
  },
  cardFront: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    padding: CARD_PAD,
    ...theme.shadows.card,
  },
  cardPhoto: {
    height: 96,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.water,
  },
  cardLines: {
    marginTop: 12,
    gap: 9,
    alignItems: 'flex-start',
  },
  line: {
    height: 9,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceAlt,
  },
  discStage: {
    width: CIRCLE + 44,
    height: CIRCLE + 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
});
