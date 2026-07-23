import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useCurrentMonth } from '@/features/photos/hooks/useCurrentMonth';

import { InsightHero } from '../components/InsightHero';
import { InsightRow } from '../components/InsightRow';
import { useIsPro } from '../hooks/useIsPro';
import { useMonthlyInsights } from '../hooks/useMonthlyInsights';

function formatBusiestDay(date: string, count: number): string {
  const [, m, d] = date.split('-');
  return strings.insights.busiestDayValue(
    Number(m),
    Number(d),
    count,
  );
}

export function InsightsScreen() {
  const { month } = useCurrentMonth();
  const { isPro } = useIsPro();
  const {
    insights,
    isPending,
    isError,
    isEmpty,
    isResolvingLabels,
    refetch,
  } = useMonthlyInsights(month);

  if (isPending) {
    return <LoadingView />;
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.insights.title} />
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={refetch}
        />
      </SafeAreaView>
    );
  }

  if (isEmpty || !insights) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.insights.title} />
        <StateView icon="🗺️" title={strings.insights.empty} />
      </SafeAreaView>
    );
  }

  const farthestValue =
    insights.farthestLabeled == null
      ? null
      : strings.insights.farthestValue(
          insights.farthestLabeled.label ?? strings.insights.unknownPlace,
          insights.farthestLabeled.distanceKm,
        );

  const topValue =
    insights.topPlaceLabeled == null
      ? null
      : strings.insights.topPlaceValue(
          insights.topPlaceLabeled.label ?? strings.insights.unknownPlace,
          insights.topPlaceLabeled.photoCount,
        );

  const distanceValue =
    insights.approxDistanceKm == null
      ? null
      : strings.insights.approxDistanceValue(insights.approxDistanceKm);

  const busiestValue =
    insights.busiestDay == null
      ? null
      : formatBusiestDay(insights.busiestDay.date, insights.busiestDay.count);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.insights.title} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.monthHint}>{month}</Text>
        {isResolvingLabels ? (
          <Text style={styles.resolving}>{strings.common.loading}</Text>
        ) : null}

        <InsightHero
          placesCount={insights.placesCount}
          newPlacesCount={insights.newPlacesCount}
          placesLabel={strings.insights.placesCount}
          newPlacesLabel={strings.insights.newPlaces}
          newPlacesHiddenHint={strings.insights.newPlacesWarming}
        />

        <View style={styles.list}>
          {farthestValue ? (
            <InsightRow
              title={strings.insights.farthest}
              value={farthestValue}
            />
          ) : null}
          {topValue ? (
            <InsightRow title={strings.insights.topPlace} value={topValue} />
          ) : null}
          {distanceValue ? (
            <InsightRow
              title={strings.insights.approxDistance}
              value={distanceValue}
              locked={!isPro}
              lockedTag={strings.insights.proTag}
            />
          ) : null}
          {busiestValue ? (
            <InsightRow
              title={strings.insights.busiestDay}
              value={busiestValue}
              locked={!isPro}
              lockedTag={strings.insights.proTag}
            />
          ) : null}
        </View>

        {!isPro ? (
          <Text style={styles.proHint}>{strings.insights.proHint}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  monthHint: {
    ...theme.type.label,
    color: theme.colors.subtle,
    fontWeight: '600',
  },
  resolving: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  list: {
    gap: theme.spacing.sm,
  },
  proHint: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 18,
  },
});
