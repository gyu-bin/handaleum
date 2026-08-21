import { useCallback, useEffect, useMemo } from 'react';
import {
  FlatList,
  InteractionManager,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { AssetThumbImage } from '../components/AssetThumbImage';
import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePauseGridThumbWarmOnScroll } from '../hooks/usePauseGridThumbWarmOnScroll';
import { warmGridThumbs } from '../services/mediaLibrary';
import type { NoLocationPhoto } from '../types';

const COLS = 3;

function formatMonthDot(month: string): string {
  const [year, mon] = month.split('-');
  return `${year}. ${mon}`;
}

function chunkRows(photos: NoLocationPhoto[]): NoLocationPhoto[][] {
  const rows: NoLocationPhoto[][] = [];
  for (let i = 0; i < photos.length; i += COLS) {
    rows.push(photos.slice(i, i + COLS));
  }
  return rows;
}

export function NoLocationPhotosScreen() {
  const { month } = useCurrentMonth();
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const showLoading = useHeldBusy(isPending);
  const thumbWarmScroll = usePauseGridThumbWarmOnScroll();

  const rows = useMemo(() => {
    const list = data?.noLocationPhotos ?? [];
    const sorted = [...list].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    return chunkRows(sorted);
  }, [data?.noLocationPhotos]);

  const cellSize = (width - theme.spacing.lg * 2) / COLS;

  useEffect(() => {
    const ids = data?.noLocationPhotos.map((p) => p.assetId) ?? [];
    const handle = InteractionManager.runAfterInteractions(() => {
      warmGridThumbs(ids, 64);
    });
    return () => handle.cancel();
  }, [data?.noLocationPhotos]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<NoLocationPhoto[]>) => (
      <View style={styles.gridRow}>
        {item.map((photo) => {
          const inner = Math.max(1, cellSize - 4);
          return (
            <View
              key={photo.assetId}
              style={{ width: cellSize, height: cellSize, padding: 2 }}
            >
              <View
                style={[styles.tile, { backgroundColor: colors.shellChip }]}
              >
                <AssetThumbImage assetId={photo.assetId} size={inner} />
              </View>
            </View>
          );
        })}
        {item.length < COLS
          ? Array.from({ length: COLS - item.length }, (_, i) => (
              <View key={`pad-${i}`} style={{ width: cellSize }} />
            ))
          : null}
      </View>
    ),
    [cellSize, colors.shellChip],
  );

  if (showLoading) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.settings.noLocationTitle} />
        <StateView
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.settings.noLocationTitle} />
      <Text style={[styles.subtitle, shell.subtle]}>
        {strings.settings.noLocationSubtitle(formatMonthDot(month))}
      </Text>
      {rows.length === 0 ? (
        <StateView title={strings.settings.noLocationEmpty} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item[0]?.assetId ?? 'row'}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={thumbWarmScroll.onScrollBeginDrag}
          onMomentumScrollBegin={thumbWarmScroll.onMomentumScrollBegin}
          onScrollEndDrag={thumbWarmScroll.onScrollEndDrag}
          onMomentumScrollEnd={thumbWarmScroll.onMomentumScrollEnd}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  subtitle: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  gridRow: {
    flexDirection: 'row',
  },
  tile: {
    aspectRatio: 1,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
});
