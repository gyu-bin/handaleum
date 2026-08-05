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
        <PaperGrain style={styles.grain} />
        <LoadingView />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <PaperGrain style={styles.grain} />
        <BackLink onPress={() => router.back()} />
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
        <PaperGrain style={styles.grain} />
        <BackLink onPress={() => router.back()} />
        <StateView title={strings.months.empty} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PaperGrain style={styles.grain} />
      <BackLink onPress={() => router.back()} />
      <MonthPickerList
        summaries={data}
        selected={month}
        onSelect={setMonth}
        canOpenMonth={canOpenMonth}
      />
    </SafeAreaView>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.backOnly, pressed && styles.backPressed]}
      accessibilityRole="button"
      accessibilityLabel={strings.common.back}
      hitSlop={8}
    >
      <Text style={styles.backText}>‹  {strings.common.back}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  grain: {
    opacity: 0.35,
  },
  backOnly: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 0,
    paddingBottom: 2,
    zIndex: 1,
  },

  backPressed: {
    opacity: 0.55,
  },
  backText: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
});
