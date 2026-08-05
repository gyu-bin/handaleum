import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampLibraryProgress } from '../services/stampBackfill';

function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}

function lineFor(progress: StampLibraryProgress): string {
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
  return '';
}

function ratio(progress: StampLibraryProgress): number {
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

export interface IndexingBannerProps {
  progress: StampLibraryProgress;
}

/** Minimal home indexing strip — one line + hairline bar. */
export function IndexingBanner({ progress }: IndexingBannerProps) {
  if (progress.phase === 'idle') {
    return null;
  }

  const line = lineFor(progress);
  const fill = ratio(progress);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={line}
    >
      <Text style={styles.line} numberOfLines={1}>
        {line}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(fill * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    gap: 6,
  },
  line: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  track: {
    height: 1,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.colors.ink,
  },
});
