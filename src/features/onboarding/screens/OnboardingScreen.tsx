import { useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { usePhotoPermission } from '@/features/photos';

import { AccessArt, CardArt, MapPinArt } from '../components/OnboardingArt';
import { OnboardingSlide } from '../components/OnboardingSlide';
import { useOnboarding } from '../hooks/useOnboarding';

/** Animated brand visuals, index-matched to strings.onboarding.slides. */
const ART = [<MapPinArt key="map" />, <CardArt key="card" />, <AccessArt key="access" />];

export function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { markSeen } = useOnboarding();
  const { request } = usePhotoPermission();
  const listRef = useRef<FlatList<(typeof strings.onboarding.slides)[number]>>(null);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const slides = strings.onboarding.slides;
  const isLast = index === slides.length - 1;

  const goTo = (next: number) => {
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const onFinish = async () => {
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
        {isLast ? null : (
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

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <OnboardingSlide width={width} art={ART[i]} title={item.title} body={item.body} />
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View
              key={slide.title}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <Button
          title={isLast ? strings.onboarding.grant : strings.onboarding.next}
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
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.accent,
    width: 20,
  },
});
