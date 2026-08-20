import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StampShoeIcon } from '@/shared/components/StampShoeIcon';
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
  return strings.stamps.backfilling;
}

function ratio(progress: StampLibraryProgress, shownDone: number): number {
  if (progress.phase === 'gps' && progress.assetTotal > 0) {
    return Math.min(1, shownDone / progress.assetTotal);
  }
  if (progress.phase === 'geocode' && progress.chunkTotal > 0) {
    return Math.min(1, shownDone / progress.chunkTotal);
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

export interface StampIndexingGateProps {
  progress: StampLibraryProgress;
}

/**
 * Blocks stamp browsing while library sync runs.
 * Back to home stays available (header outside this gate).
 */
export function StampIndexingGate({ progress }: StampIndexingGateProps) {
  const shell = useShellInk();
  const [shownDone, setShownDone] = useState(targetDone(progress));
  const shownRef = useRef(shownDone);
  const phaseRef = useRef(progress.phase);

  useEffect(() => {
    if (progress.phase !== 'gps' && progress.phase !== 'geocode') {
      const next = targetDone(progress);
      shownRef.current = next;
      setShownDone(next);
      phaseRef.current = progress.phase;
      return;
    }

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

  const line = lineFor(progress, shownDone);
  const fill = ratio(progress, shownDone);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={line}
      accessibilityLiveRegion="polite"
    >
      <StampShoeIcon size={48} active color={shell.fill} />
      <Text style={[styles.title, shell.ink]}>{strings.stamps.indexingGateTitle}</Text>
      <Text style={[styles.body, shell.soft]}>{strings.stamps.indexingGateBody}</Text>
      <Text style={[styles.hint, shell.subtle]}>{strings.stamps.indexingGateHint}</Text>

      <View style={styles.progressBlock}>
        <Text style={[styles.line, shell.soft]} numberOfLines={2}>
          {line}
        </Text>
        <View style={[styles.track, { backgroundColor: shell.line }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(fill * 100)}%`,
                backgroundColor: shell.fill,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  body: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    lineHeight: 22,
  },
  hint: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  progressBlock: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: theme.spacing.sm,
  },
  line: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
    textAlign: 'center',
  },
  track: {
    height: 2,
    overflow: 'hidden',
    borderRadius: 1,
  },
  fill: {
    height: '100%',
  },
});
