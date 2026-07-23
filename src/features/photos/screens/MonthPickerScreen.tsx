import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
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
  const { month, setMonth, canOpenMonth } = useCurrentMonth();
  const { data, isPending, isError, refetch, isRefetching } = useMonthSummaries();

  // Warm a few recent months while the user scans the list.
  useEffect(() => {
    if (!data) {
      return;
    }
    for (const summary of data.slice(0, 4)) {
      prefetchMonthlyPhotos(summary.month);
    }
  }, [data]);

  if (isPending) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.months.title} />
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={isRefetching ? strings.common.loading : strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  if (data.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.months.title} />
        <StateView icon="📅" title={strings.months.empty} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.months.title} />
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
    backgroundColor: theme.colors.background,
  },
});
