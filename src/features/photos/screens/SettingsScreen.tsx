import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useHomeLocation } from '../hooks/useHomeLocation';
import { useDevDummyPhotos } from '../hooks/useDevDummyPhotos';
import { DEFAULT_HOME_RADIUS_M } from '../services/homeLocationStorage';
import { dummyPhotoCount } from '../services/dummyPhotos';
import { useIsPro } from '@/features/insights/hooks/useIsPro';

const RADIUS_CHOICES = [100, 300, 500, 1000] as const;

function radiusLabel(radiusM: number): string {
  return radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`;
}

export function SettingsScreen() {
  const { home, setHome, clearHome } = useHomeLocation();
  const { isPro, setIsPro } = useIsPro();
  const dummy = useDevDummyPhotos();
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radius = home?.radiusM ?? DEFAULT_HOME_RADIUS_M;

  const captureCurrentLocation = async () => {
    setError(null);
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError(strings.settings.locationDenied);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setHome({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radiusM: radius,
      });
    } catch {
      setError(strings.settings.locationFailed);
    } finally {
      setIsLocating(false);
    }
  };

  const pickRadius = (radiusM: number) => {
    if (!home) {
      return;
    }
    setHome({ ...home, radiusM });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.settings.title} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{strings.settings.homeSection}</Text>
          <Text style={styles.description}>{strings.settings.homeDescription}</Text>

          <Text style={[styles.status, home && styles.statusSet]}>
            {home
              ? strings.settings.homeSet(home.radiusM)
              : strings.settings.homeUnset}
          </Text>

          <Button
            title={
              isLocating
                ? strings.settings.locating
                : strings.settings.useCurrentLocation
            }
            variant="accent"
            size="md"
            loading={isLocating}
            onPress={() => void captureCurrentLocation()}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {home ? (
            <View style={styles.radiusBlock}>
              <Text style={styles.radiusLabel}>{strings.settings.radiusLabel}</Text>
              <View style={styles.radiusRow}>
                {RADIUS_CHOICES.map((choice) => {
                  const active = choice === home.radiusM;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => pickRadius(choice)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.radiusChip,
                        active && styles.radiusChipActive,
                        pressed && styles.radiusChipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radiusChipText,
                          active && styles.radiusChipTextActive,
                        ]}
                      >
                        {radiusLabel(choice)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hint}>{strings.settings.radiusHint}</Text>

              <Button
                title={strings.settings.clearHome}
                variant="ghost"
                size="md"
                onPress={clearHome}
              />
            </View>
          ) : null}
        </View>

        <View style={[styles.card, styles.cardSpaced]}>
          <Text style={styles.sectionTitle}>{strings.settings.proSection}</Text>
          <Text style={styles.description}>{strings.settings.proDescription}</Text>
          <Text style={[styles.status, isPro && styles.statusSet]}>
            {isPro ? strings.settings.proOn : strings.settings.proOff}
          </Text>
          <Button
            title={isPro ? strings.settings.proToggleOff : strings.settings.proToggleOn}
            variant={isPro ? 'secondary' : 'accent'}
            size="md"
            onPress={() => setIsPro(!isPro)}
          />
        </View>

        {__DEV__ ? (
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.sectionTitle}>{strings.settings.dummySection}</Text>
            <Text style={styles.description}>{strings.settings.dummyDescription}</Text>
            <Text style={[styles.status, dummy.enabled && styles.statusSet]}>
              {dummy.enabled
                ? `${strings.settings.dummyOn} · ${dummyPhotoCount()}장`
                : strings.settings.dummyOff}
            </Text>
            <Button
              title={
                dummy.enabled
                  ? strings.settings.dummyToggleOff
                  : strings.settings.dummyToggleOn
              }
              variant={dummy.enabled ? 'secondary' : 'accent'}
              size="md"
              onPress={() => dummy.setEnabled(!dummy.enabled)}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  content: {
    padding: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    ...theme.shadows.card,
  },
  cardSpaced: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.type.title,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  description: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  status: {
    ...theme.type.label,
    fontWeight: '600',
    color: theme.colors.subtle,
    paddingVertical: theme.spacing.xs,
  },
  statusSet: {
    color: theme.colors.accent,
  },
  error: {
    ...theme.type.micro,
    color: theme.colors.ink,
  },
  radiusBlock: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  radiusLabel: {
    ...theme.type.micro,
    fontWeight: '600',
    color: theme.colors.subtle,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  radiusChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  radiusChipPressed: {
    opacity: 0.7,
  },
  radiusChipText: {
    ...theme.type.label,
    fontWeight: '600',
    color: theme.colors.inkSoft,
  },
  radiusChipTextActive: {
    color: theme.colors.accent,
  },
  hint: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
});
