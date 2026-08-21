import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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
import { useHiddenPhotos } from '../hooks/useHiddenPhotos';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { peekResolvedPlace } from '../services/placeResolve';
import type { PhotoRef } from '../types';

const THUMB = 56;

function formatMonthDot(month: string): string {
  const [year, mon] = month.split('-');
  return `${year}. ${mon}`;
}

type HiddenRow = {
  assetId: string;
  photo: PhotoRef | null;
};

function HiddenPhotoRow({
  row,
  onRestore,
}: {
  row: HiddenRow;
  onRestore: (assetId: string) => void;
}) {
  const shell = useShellInk();
  const { colors } = useTheme();
  const { photo, assetId } = row;
  const place = photo ? peekResolvedPlace(photo.lat, photo.lng)?.detailLabel : null;
  const meta = photo
    ? [strings.playback.chapterDay(photo.takenAt), place]
        .filter(Boolean)
        .join(' · ')
    : strings.settings.hiddenPhotoOrphan;

  return (
    <View style={[styles.row, { borderBottomColor: colors.hairline }]}>
      <AssetThumbImage assetId={assetId} size={THUMB} style={styles.thumb} />
      <View style={styles.meta}>
        <Text style={[styles.metaText, shell.soft]} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      <Pressable
        onPress={() => onRestore(assetId)}
        accessibilityRole="button"
        accessibilityLabel={strings.settings.hiddenPhotoRestore}
        style={({ pressed }) => [
          styles.restoreBtn,
          { backgroundColor: colors.shellChip, borderColor: colors.border },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.restoreText, shell.ink]}>
          {strings.settings.hiddenPhotoRestore}
        </Text>
      </Pressable>
    </View>
  );
}

export function HiddenPhotosScreen() {
  const { month } = useCurrentMonth();
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const { hidden, unhide } = useHiddenPhotos(month);
  const showLoading = useHeldBusy(isPending);

  const rows = useMemo((): HiddenRow[] => {
    const byId = new Map(data?.allPhotos.map((photo) => [photo.assetId, photo]));
    return [...hidden]
      .map((assetId) => ({
        assetId,
        photo: byId.get(assetId) ?? null,
      }))
      .sort((a, b) => {
        const aAt = a.photo?.takenAt ?? '';
        const bAt = b.photo?.takenAt ?? '';
        if (aAt && bAt) {
          return bAt.localeCompare(aAt);
        }
        if (aAt) {
          return -1;
        }
        if (bAt) {
          return 1;
        }
        return a.assetId.localeCompare(b.assetId);
      });
  }, [data?.allPhotos, hidden]);

  if (showLoading) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.settings.hiddenPhotosTitle} />
        <StateView
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: ListRenderItemInfo<HiddenRow>) => (
    <HiddenPhotoRow row={item} onRestore={unhide} />
  );

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.settings.hiddenPhotosTitle} />
      <Text style={[styles.subtitle, shell.subtle]}>
        {strings.settings.hiddenPhotosSubtitle(formatMonthDot(month))}
      </Text>
      {rows.length === 0 ? (
        <StateView icon="🖼️" title={strings.settings.hiddenPhotosEmpty} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.assetId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    borderRadius: theme.radius.sm,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  metaText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
  },
  restoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  restoreText: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
