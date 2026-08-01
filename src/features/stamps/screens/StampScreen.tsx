import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

import {
  CityStampSections,
  type CityStampSection,
} from '../components/CityStampSections';
import { MascotPin } from '../components/MascotPin';
import { RegionChips } from '../components/RegionChips';
import { StampEarnOverlay } from '../components/StampEarnOverlay';
import { useStampBackfill } from '../hooks/useStampBackfill';
import { useStampSync } from '../hooks/useStampSync';
import { useStamps } from '../hooks/useStamps';
import {
  SIDO_ORDER,
  cityListForSido,
  isGeneralGuParentCity,
  stampId,
  unitsForCity,
} from '../services/sigunguIndex';
import {
  countCollectedInCity,
  countCollectedInSido,
  firstsInMonth,
} from '../services/stampsStorage';

function tiltForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 17;
  }
  return h - 8;
}

/**
 * 발도장 — 시·도 칩 + 한 페이지에서 시별 구역(일반구 시는 그룹).
 */
export function StampScreen() {
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
  const { backfilling } = useStampBackfill(month);

  const { collected, unseen, collectedCount, markAllSeen } = useStamps();
  const [sido, setSido] = useState(SIDO_ORDER[0] ?? '서울');
  const [celebrate, setCelebrate] = useState<string[] | null>(null);
  const [animateIds, setAnimateIds] = useState<Set<string>>(() => new Set());
  const [replayNonce, setReplayNonce] = useState<Record<string, number>>({});
  const entryHandled = useRef(false);

  useEffect(() => {
    if (entryHandled.current || unseen.length === 0) {
      return;
    }
    entryHandled.current = true;

    const ids = new Set<string>();
    const names: string[] = [];
    for (const id of unseen) {
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
      setCelebrate(names.slice(0, 5));
      const firstId = unseen[0];
      const first = firstId ? collected[firstId] : undefined;
      if (first?.sido) {
        setSido(first.sido);
      }
    }
    markAllSeen();
  }, [collected, markAllSeen, unseen]);

  const onOverlayDone = useCallback(() => {
    setCelebrate(null);
  }, []);

  const onReplayStamp = useCallback((id: string) => {
    setReplayNonce((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const cities = useMemo(() => cityListForSido(sido), [sido]);
  const collectedInSido = countCollectedInSido(collected, sido);
  const monthFirsts = firstsInMonth(collected, month);

  const sections: CityStampSection[] = useMemo(() => {
    // Only 일반구 시 (창원·용인…) get a labeled block. Metro 구 + 군 + plain
    // 시·군 share one continuous 3-col grid — avoids 기장군 alone above 부산 구.
    const groups: CityStampSection[] = [];
    let leafUnits: CityStampSection['units'] = [];
    let leafCollected = 0;
    let leafTotal = 0;

    for (const city of cities) {
      const units = unitsForCity(sido, city);
      const collectedCountInCity = countCollectedInCity(
        collected,
        sido,
        city,
        units,
      );
      const mapped = units.map((name) => {
        const id = stampId(sido, name);
        return {
          id,
          name,
          collected: Boolean(collected[id]),
          animateIn: animateIds.has(id),
          tiltDeg: tiltForName(name),
        };
      });

      if (isGeneralGuParentCity(city) && units.length > 1) {
        groups.push({
          city,
          grouped: true,
          showHeader: true,
          collected: collectedCountInCity,
          total: units.length,
          units: mapped,
        });
      } else {
        leafUnits = leafUnits.concat(mapped);
        leafCollected += collectedCountInCity;
        leafTotal += units.length;
      }
    }

    leafUnits.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const out = [...groups];
    if (leafUnits.length > 0) {
      out.push({
        city: '__leaves__',
        grouped: false,
        showHeader: false,
        collected: leafCollected,
        total: leafTotal,
        units: leafUnits,
      });
    }
    return out;
  }, [animateIds, cities, collected, sido]);

  const progressTotal = useMemo(
    () => cities.reduce((n, c) => n + unitsForCity(sido, c).length, 0),
    [cities, sido],
  );
  const progressPct =
    progressTotal === 0
      ? 0
      : Math.min(100, (collectedInSido / progressTotal) * 100);

  if (!isReady || (photosQuery.isPending && hasAccess && !backfilling)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <LoadingView message={strings.stamps.loading} />
      </SafeAreaView>
    );
  }

  if (photosQuery.isError && !backfilling) {
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

  const empty = collectedCount === 0 && !backfilling;

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
          {strings.stamps.progress(collectedInSido, progressTotal)}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {backfilling && collectedCount === 0 ? (
        <LoadingView message={strings.stamps.backfilling} />
      ) : empty ? (
        <View style={styles.emptyWrap}>
          <MascotPin size={48} />
          <StateView
            title={strings.stamps.emptyTitle}
            description={strings.stamps.empty}
          />
        </View>
      ) : (
        <CityStampSections
          sections={sections}
          replayNonce={replayNonce}
          onReplay={onReplayStamp}
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
});
