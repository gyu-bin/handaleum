import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { usePhotoPermission } from '@/features/photos';

import { AccessArt, CardArt, MapPinArt } from '../components/OnboardingArt';
import { OnboardingSlide } from '../components/OnboardingSlide';
import { useOnboarding } from '../hooks/useOnboarding';

/** Dot that stretches and tints smoothly as the pager scrolls past it. */
function PagerDot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const pos = scrollX.value / width;
    return {
      width: interpolate(
        pos,
        [index - 1, index, index + 1],
        [7, 20, 7],
        Extrapolation.CLAMP,
      ),
      backgroundColor: interpolateColor(
        pos,
        [index - 1, index, index + 1],
        [theme.colors.border, theme.colors.accent, theme.colors.border],
      ),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ replay?: string }>();
  const isReplay = params.replay === '1';
  const { markSeen } = useOnboarding();
  const { request } = usePhotoPermission();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const slides = strings.onboarding.slides;
  const isLast = index === slides.length - 1;

  // Stable art nodes — must not recreate on page index changes (causes swipe hitch).
  const slideArts = useMemo(
    () => [<MapPinArt key="map" />, <CardArt key="card" />, <AccessArt key="access" />],
    [],
  );

  const pages = useMemo(
    () =>
      slides.map((slide, i) => (
        <OnboardingSlide
          key={slide.title}
          width={width}
          index={i}
          scrollX={scrollX}
          art={slideArts[i]}
          title={slide.title}
          body={slide.body}
        />
      )),
    [slides, width, slideArts, scrollX],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onMomentumEnd: (e) => {
      const next = Math.round(e.contentOffset.x / width);
      runOnJS(setIndex)(next);
    },
  });

  const goTo = useCallback(
    (next: number) => {
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    },
    [width],
  );

  const leaveReplay = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const onFinish = async () => {
    if (isReplay) {
      leaveReplay();
      return;
    }
    setBusy(true);
    markSeen();
    const next = await request();
    const granted = next === 'granted' || next === 'limited';
    router.replace(granted ? '/' : '/permission');
  };

  const onPrimary = () => {
    if (isLast) {
      void onFinish();
    } else {
      goTo(index + 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.topRow}>
        {isReplay ? (
          <Pressable
            onPress={leaveReplay}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
          >
            <Text style={styles.skipText}>{strings.onboarding.close}</Text>
          </Pressable>
        ) : isLast ? null : (
          <Pressable
            onPress={() => goTo(slides.length - 1)}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
          >
            <Text style={styles.skipText}>{strings.onboarding.skip}</Text>
          </Pressable>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={styles.list}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {pages}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <PagerDot key={slide.title} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>
        <Button
          title={
            isLast
              ? isReplay
                ? strings.onboarding.close
                : strings.onboarding.grant
              : strings.onboarding.next
          }
          variant="accent"
          loading={busy}
          onPress={onPrimary}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  list: {
    flex: 1,
  },
  topRow: {
    height: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  skip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipPressed: {
    opacity: 0.6,
  },
  skipText: {
    ...theme.type.label,
    color: theme.colors.subtle,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
});
