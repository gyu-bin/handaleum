import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { BrandMark, PinGlyph } from '@/shared/components/BrandMark';
import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { theme } from '@/shared/constants/theme';

// Onboarding is a launch moment, so — like the splash — the motion always plays:
// ReduceMotion.Never opts these loops out of the OS "reduce motion" setting.
const LOOP = ReduceMotion.Never;

function clamp01(v: number): number {
  'worklet';
  return Math.max(0, Math.min(1, v));
}

/* ── Slide 1 — pins stamp onto the map, one by one, on a loop ─────────────── */

const MAP_H = 194;
const PIN_H = 30;
const PIN_W = PIN_H * (24 / 32);
const RIPPLE = 36;
const DROP = 34;
const STAMP_CITIES = KOREA_SILHOUETTE.pins.slice(0, 4); // 서울·강릉·부산·광주
const STAMP_MS = 3400;

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
  const dropStart = 0.06 + order * 0.13;
  const dropDur = 0.16;
  const landAt = dropStart + dropDur;

  const pinStyle = useAnimatedStyle(() => {
    const wp = clamp01((cycle.value - dropStart) / dropDur);
    const ep = clamp01((cycle.value - 0.82) / 0.15); // erase near the end
    return {
      opacity: Math.min(1, wp * 3) * (1 - ep),
      transform: [{ translateY: (wp - 1) * DROP }],
    };
  });
  const pingStyle = useAnimatedStyle(() => {
    const ep = clamp01((cycle.value - 0.82) / 0.15);
    const pingP = clamp01((cycle.value - landAt) / 0.22);
    const active = cycle.value >= landAt ? 1 : 0;
    return {
      opacity: 0.45 * (1 - pingP) * (1 - ep) * active,
      transform: [{ scale: 0.3 + pingP * 1.6 }],
    };
  });

  return (
    <>
      <Animated.View
        style={[styles.ripple, { left: x - RIPPLE / 2, top: y - RIPPLE / 2 }, pingStyle]}
      />
      <Animated.View
        style={[styles.pin, { left: x - PIN_W / 2, top: y - PIN_H }, pinStyle]}
      >
        <PinGlyph size={PIN_H} />
      </Animated.View>
    </>
  );
}

export function MapPinArt() {
  const width = MAP_H * KOREA_SILHOUETTE.aspect;
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = withRepeat(
      withTiming(1, { duration: STAMP_MS, easing: Easing.linear, reduceMotion: LOOP }),
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
    <View style={{ width, height: MAP_H }}>
      <BrandMark height={MAP_H} />
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

/* ── Slide 2 — skeleton text writes itself into the card, on a loop ───────── */

const CARD_W = 158;
const CARD_H = 198;
const CARD_PAD = 14;
const INNER_W = CARD_W - CARD_PAD * 2;
const WRITE_MS = 3200;
/** Full widths per skeleton line (px), top to bottom. */
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
    const ep = clamp01((cycle.value - 0.84) / 0.14); // erase before repeating
    return { width: full * wp * (1 - ep) };
  });
  return <Animated.View style={[styles.line, style]} />;
}

export function CardArt() {
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = withRepeat(
      withTiming(1, { duration: WRITE_MS, easing: Easing.linear, reduceMotion: LOOP }),
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

/* ── Slide 3 — map inside a soft disc with a scanning pulse ring ───────────── */

const CIRCLE = 184;
const DISC = 156;

export function AccessArt() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad), reduceMotion: LOOP }),
      -1,
      false,
      undefined,
      LOOP,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.32 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.24 }],
  }));

  return (
    <View style={styles.discStage}>
      <Animated.View style={[styles.pulseRing, ringStyle]} />
      <View style={styles.disc}>
        <BrandMark height={118} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ripple: {
    position: 'absolute',
    width: RIPPLE,
    height: RIPPLE,
    borderRadius: RIPPLE / 2,
    borderWidth: 2,
    borderColor: theme.colors.accent,
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
