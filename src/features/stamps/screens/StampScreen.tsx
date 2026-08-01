import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useCurrentMonth } from '@/features/photos/hooks/useCurrentMonth';
import { useMonthJourney } from '@/features/photos/hooks/useMonthJourney';
import { useMonthlyPhotos } from '@/features/photos/hooks/useMonthlyPhotos';
import { usePhotoPermission } from '@/features/photos/hooks/usePhotoPermission';
import { isDevDummyPhotosEnabled } from '@/features/photos/services/dummyPhotos';

import { MascotPin } from '../components/MascotPin';
import { RegionChips } from '../components/RegionChips';
import { StampBadge } from '../components/StampBadge';
import { StampEarnOverlay } from '../components/StampEarnOverlay';
import { useStampSync } from '../hooks/useStampSync';
import { useStamps } from '../hooks/useStamps';
import {
  SIDO_ORDER,
  sigunguListForSido,
  stampId,
} from '../services/sigunguIndex';
import {
  countCollectedInSido,
  firstsInMonth,
} from '../services/stampsStorage';

type GridItem = {
  name: string;
  collected: boolean;
  animateIn: boolean;
  tiltDeg: number;
  id: string;
};

function tiltForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 17;
  }
  return h - 8;
}

/**
 * 발도장 — collected 시군구 seals, sido progress, earn overlay.
 */
export function StampScreen() {
  const { width } = useWindowDimensions();
  const { month } = useCurrentMonth();
  const { status, isReady } = usePhotoPermission();
  const hasAccess =
    status === 'granted' || status === 'limited' || isDevDummyPhotosEnabled();
  const photosQuery = useMonthlyPhotos(month, {
    enabled: isReady && hasAccess,
  });
  const photos = photosQuery.data?.photos ?? [];
  const { visitPlaces } = useMonthJourney(photos);
  useStampSync(month, visitPlaces);

  const { collected, unseen, collectedCount, markAllSeen } = useStamps();
  const [sido, setSido] = useState(SIDO_ORDER[0] ?? '서울');
  const [celebrate, setCelebrate] = useState<string[] | null>(null);
  const [animateIds, setAnimateIds] = useState<Set<string>>(() => new Set());
  /** Bump to remount a badge and replay the slam (tap collected stamp). */
  const [replayNonce, setReplayNonce] = useState<Record<string, number>>({});
  const entryHandled = useRef(false);

  // On entry: play slam for unseen, or (if already seen) this month's firsts.
  useEffect(() => {
    if (entryHandled.current) {
      return;
    }
    entryHandled.current = true;

    const ids = new Set<string>();
    const names: string[] = [];

    const sourceIds =
      unseen.length > 0
        ? unseen
        : Object.entries(collected)
            .filter(([, e]) => e.firstMonth === month)
            .map(([id]) => id);

    for (const id of sourceIds) {
      const entry = collected[id];
      if (!entry) {
        continue;
      }
      ids.add(id);
      if (!names.includes(entry.name)) {
        names.push(entry.name);
      }
    }

    if (ids.size > 0) {
      setAnimateIds(ids);
      // Overlay: a few "쾅"s — full list would take too long for 19+.
      setCelebrate(names.slice(0, 5));
      const firstId = sourceIds[0];
      const first = firstId ? collected[firstId] : undefined;
      if (first?.sido) {
        setSido(first.sido);
      }
    }
    markAllSeen();
  }, [collected, markAllSeen, month, unseen]);

  const onOverlayDone = useCallback(() => {
    setCelebrate(null);
  }, []);

  const onReplayStamp = useCallback((id: string) => {
    setReplayNonce((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const list = sigunguListForSido(sido);
  const collectedInSido = countCollectedInSido(collected, sido);
  const monthFirsts = firstsInMonth(collected, month);

  const data: GridItem[] = useMemo(() => {
    const inList = new Set(list);
    const rows: GridItem[] = list.map((name) => {
      const id = stampId(sido, name);
      return {
        id,
        name,
        collected: Boolean(collected[id]),
        animateIn: animateIds.has(id),
        tiltDeg: tiltForName(name),
      };
    });
    for (const [id, entry] of Object.entries(collected)) {
      if (entry.sido !== sido || inList.has(entry.name)) {
        continue;
      }
      rows.push({
        id,
        name: entry.name,
        collected: true,
        animateIn: animateIds.has(id),
        tiltDeg: tiltForName(entry.name),
      });
    }
    return rows;
  }, [animateIds, collected, list, sido]);

  const gap = theme.spacing.sm;
  const pad = theme.spacing.lg;
  const colW = (width - pad * 2 - gap * 2) / 3;
  const progressDenom = Math.max(list.length, collectedInSido);
  const progressPct =
    progressDenom === 0
      ? 0
      : Math.min(100, (collectedInSido / progressDenom) * 100);

  if (!isReady || (photosQuery.isPending && hasAccess)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <LoadingView message={strings.stamps.loading} />
      </SafeAreaView>
    );
  }

  if (photosQuery.isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StateView
          title={strings.stamps.errorTitle}
          description={
            photosQuery.error instanceof Error
              ? photosQuery.error.message
              : undefined
          }
          actionLabel={strings.stamps.errorRetry}
          onAction={() => void photosQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const empty = collectedCount === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {celebrate && celebrate.length > 0 ? (
        <StampEarnOverlay names={celebrate} onDone={onOverlayDone} />
      ) : null}

      <ScreenHeader
        title={strings.stamps.title}
        trailing={
          monthFirsts > 0 ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {strings.stamps.newThisMonth(monthFirsts)}
              </Text>
            </View>
          ) : undefined
        }
      />

      <RegionChips sidos={SIDO_ORDER} selected={sido} onSelect={setSido} />

      <View style={styles.progressBlock}>
        <Text style={styles.progressLabel}>
          {strings.stamps.progressLabel(sido)}
          {strings.stamps.progress(collectedInSido, progressDenom)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {empty ? (
        <View style={styles.emptyWrap}>
          <MascotPin size={48} />
          <StateView
            title={strings.stamps.emptyTitle}
            description={strings.stamps.empty}
          />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const nonce = replayNonce[item.id] ?? 0;
            return (
              <View style={{ width: colW }}>
                <StampBadge
                  key={`${item.id}-${nonce}`}
                  name={item.name}
                  collected={item.collected}
                  animateIn={item.animateIn || nonce > 0}
                  tiltDeg={item.tiltDeg}
                  onPress={
                    item.collected ? () => onReplayStamp(item.id) : undefined
                  }
                />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  pill: {
    backgroundColor: theme.colors.sand,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  pillText: {
    ...theme.type.micro,
    color: theme.colors.white,
    fontWeight: '700',
  },
  progressBlock: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  progressLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
  },
  grid: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  gridRow: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
});
