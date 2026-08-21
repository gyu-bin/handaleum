import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';
import type { StampLibraryProgress } from '@/features/stamps/services/stampBackfill';

function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}

function progressLine(progress: StampLibraryProgress): string {
  if (progress.phase === 'gps') {
    if (progress.assetTotal <= 0) {
      return strings.map.indexingPreparing;
    }
    return `${strings.map.indexingPhotos}  ${strings.map.indexingPhotoCount(
      formatCount(progress.assetScanned),
      formatCount(progress.assetTotal),
    )}`;
  }
  if (progress.phase === 'geocode') {
    if (progress.chunkTotal > 0) {
      return `${strings.map.indexingPlaces}  ${progress.chunkDone}/${progress.chunkTotal}`;
    }
    return strings.map.indexingPlacesEmpty;
  }
  if (progress.phase === 'done') {
    return progress.photoCount > 0
      ? `${strings.map.indexingDone}  ${strings.map.indexingDoneDetail(
          formatCount(progress.photoCount),
        )}`
      : strings.map.indexingDone;
  }
  return strings.settings.albumSyncing;
}

function progressRatio(progress: StampLibraryProgress): number {
  if (progress.phase === 'gps' && progress.assetTotal > 0) {
    return Math.min(1, progress.assetScanned / progress.assetTotal);
  }
  if (progress.phase === 'geocode' && progress.chunkTotal > 0) {
    return Math.min(1, progress.chunkDone / progress.chunkTotal);
  }
  if (progress.phase === 'done') {
    return 1;
  }
  return 0.06;
}

/**
 * Whether the dock has anything to say. Callers need this separately to reserve
 * scroll padding underneath it.
 */
export function isLibrarySyncVisible(
  progress: StampLibraryProgress,
  syncing: boolean,
): boolean {
  return (
    syncing ||
    progress.phase === 'gps' ||
    progress.phase === 'geocode' ||
    progress.phase === 'done'
  );
}

export interface LibrarySyncDockProps {
  progress: StampLibraryProgress;
  syncing: boolean;
}

/** Bottom strip reporting the full-album scan. Renders nothing while idle. */
export function LibrarySyncDock({ progress, syncing }: LibrarySyncDockProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!isLibrarySyncVisible(progress, syncing)) {
    return null;
  }

  const line = progressLine(progress);
  const fill = progressRatio(progress);

  return (
    <View
      style={[
        styles.dock,
        {
          backgroundColor: colors.shellSurface,
          borderTopColor: colors.hairline,
          paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
        },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={line}
    >
      <Text
        style={[styles.line, { color: colors.shellInkSoft }]}
        numberOfLines={1}
      >
        {line}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.line }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.shellInk,
              width: `${Math.round(fill * 100)}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  line: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
  },
  track: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
