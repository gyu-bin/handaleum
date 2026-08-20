import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellInk } from '@/shared/hooks/useShellBackground';

import type { StampLibraryProgress } from '../services/stampBackfill';

function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}

function percentOf(done: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((done / total) * 100));
}

function lineFor(
  progress: StampLibraryProgress,
  shownDone: number,
): string {
  if (progress.phase === 'gps') {
    if (progress.assetTotal <= 0) {
      return strings.map.indexingPreparing;
    }
    const pct = percentOf(shownDone, progress.assetTotal);
    return `${strings.map.indexingPhotos}  ${strings.map.indexingPhotoCount(
      formatCount(shownDone),
      formatCount(progress.assetTotal),
    )}  ${strings.map.indexingPercent(pct)}`;
  }
  if (progress.phase === 'geocode') {
    if (progress.chunkTotal > 0) {
      const pct = percentOf(shownDone, progress.chunkTotal);
      return `${strings.map.indexingPlaces}  ${strings.map.indexingPlaceCount(
        formatCount(shownDone),
        formatCount(progress.chunkTotal),
      )}  ${strings.map.indexingPercent(pct)}`;
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

function ratio(progress: StampLibraryProgress, shownDone: number): number {
  if (progress.phase === 'gps' && progress.assetTotal > 0) {
    return Math.min(1, shownDone / progress.assetTotal);
  }
  if (progress.phase === 'geocode' && progress.chunkTotal > 0) {
    return Math.min(1, shownDone / progress.chunkTotal);
  }
  if (progress.phase === 'done') {
    return 1;
  }
  return 0.06;
}

function targetDone(progress: StampLibraryProgress): number {
  if (progress.phase === 'gps') {
    return progress.assetScanned;
  }
  if (progress.phase === 'geocode') {
    return progress.chunkDone;
  }
  return 0;
}

export interface IndexingBannerProps {
  progress: StampLibraryProgress;
}

/** Minimal home indexing strip — one line + hairline bar. */
export function IndexingBanner({ progress }: IndexingBannerProps) {
  const shell = useShellInk();
  const [shownDone, setShownDone] = useState(targetDone(progress));
  const shownRef = useRef(shownDone);
  const phaseRef = useRef(progress.phase);

  // Tick the counter toward the latest value so GPS / 동네 counts climb live.
  useEffect(() => {
    if (progress.phase !== 'gps' && progress.phase !== 'geocode') {
      const next = targetDone(progress);
      shownRef.current = next;
      setShownDone(next);
      phaseRef.current = progress.phase;
      return;
    }

    // Phase change — snap so we don't animate 18k → 0 places.
    if (phaseRef.current !== progress.phase) {
      phaseRef.current = progress.phase;
      const next = targetDone(progress);
      shownRef.current = next;
      setShownDone(next);
      return;
    }

    const target = targetDone(progress);
    if (shownRef.current > target) {
      shownRef.current = target;
      setShownDone(target);
      return;
    }

    let raf = 0;
    const tick = () => {
      const cur = shownRef.current;
      if (cur >= target) {
        return;
      }
      const gap = target - cur;
      const step = Math.max(1, Math.ceil(gap / 6));
      const next = Math.min(target, cur + step);
      shownRef.current = next;
      setShownDone(next);
      if (next < target) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress]);

  if (progress.phase === 'idle') {
    return null;
  }

  const line = lineFor(progress, shownDone);
  const fill = ratio(progress, shownDone);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={line}
    >
      <Text style={[styles.line, shell.soft]} numberOfLines={1}>
        {line}
      </Text>
      <View style={[styles.track, { backgroundColor: shell.line }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(fill * 100)}%`, backgroundColor: shell.fill },
          ]}
        />
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
    fontWeight: '500',
  },
  track: {
    height: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
