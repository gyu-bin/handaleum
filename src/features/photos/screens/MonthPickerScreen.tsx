import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { PaperGrain } from '@/shared/components/PaperGrain';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { MonthPickerList } from '../components/MonthPickerList';
import { useCurrentMonth } from '../hooks/useCurrentMonth';
import {
  prefetchMonthlyPhotos,
  useMonthSummaries,
} from '../hooks/useMonthlyPhotos';

export function MonthPickerScreen() {
  const router = useRouter();
  const { month, setMonth, canOpenMonth } = useCurrentMonth();
  const { data, isPending, isError, refetch, isRefetching } = useMonthSummaries();

  useEffect(() => {
    if (!data) {
      return;
    }
    for (const summary of data.slice(0, 4)) {
      prefetchMonthlyPhotos(summary.month);
    }
  }, [data]);

  if (isPending) {
    return (
      <View style={styles.safe}>
        <PaperGrain />
        <LoadingView />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <PaperGrain />
        <Pressable
          onPress={() => router.back()}
          style={styles.backOnly}
          accessibilityRole="button"
          accessibilityLabel={strings.common.back}
        >
          <Text style={styles.backText}>‹ {strings.common.back}</Text>
        </Pressable>
        <StateView
          title={strings.common.error}
          actionLabel={
            isRefetching ? strings.common.loading : strings.common.retry
          }
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  if (data.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <PaperGrain />
        <Pressable
          onPress={() => router.back()}
          style={styles.backOnly}
          accessibilityRole="button"
          accessibilityLabel={strings.common.back}
        >
          <Text style={styles.backText}>‹ {strings.common.back}</Text>
        </Pressable>
        <StateView title={strings.months.empty} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PaperGrain />
      <Pressable
        onPress={() => router.back()}
        style={styles.backOnly}
        accessibilityRole="button"
        accessibilityLabel={strings.common.back}
      >
        <Text style={styles.backText}>‹ {strings.common.back}</Text>
      </Pressable>
      <MonthPickerList
        summaries={data}
        selected={month}
        onSelect={setMonth}
        canOpenMonth={canOpenMonth}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  backOnly: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    zIndex: 1,
  },
  backText: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
});
