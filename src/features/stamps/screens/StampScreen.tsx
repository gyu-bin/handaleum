import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import {
  getStampsScanIntroSeen,
  setStampsScanIntroSeen,
} from '@/lib/storage';
import { LoadingView } from '@/shared/components/LoadingView';
import { PaperGrain } from '@/shared/components/PaperGrain';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useCurrentMonth } from '@/features/photos/hooks/useCurrentMonth';
import { usePhotoPermission } from '@/features/photos/hooks/usePhotoPermission';

import { CityList, type CityRow } from '../components/CityList';
import {
  CityStampSections,
  type CityStampSection,
} from '../components/CityStampSections';
import { MascotPin } from '../components/MascotPin';
import { RegionChips } from '../components/RegionChips';
import { StampEarnOverlay } from '../components/StampEarnOverlay';
import { StampMapModal } from '../components/StampMapModal';
import { StampScanIntroModal } from '../components/StampScanIntroModal';
import { useStampLibrarySync } from '../hooks/useStampLibrarySync';
import { useStamps } from '../hooks/useStamps';
import {
  SIDO_ORDER,
  cityListForSido,
  dongListForCity,
  stampId,
} from '../services/dongIndex';
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

function MapIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 4.5l-5.2 1.7A1 1 0 003 7.1v11.3a1 1 0 001.3.95L9 17.5l6 2 5.2-1.7A1 1 0 0021 16.9V5.6a1 1 0 00-1.3-.95L15 6.5l-6-2z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M9 4.5v13M15 6.5v13"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * 발도장 — 시·도 → 시 → 동 (방문/미방문).
 */
export function StampScreen() {
  const { month } = useCurrentMonth();
  const { isReady, status: permissionStatus } = usePhotoPermission();
  const { syncing } = useStampLibrarySync({
    isReady,
    status: permissionStatus,
  });

  const { collected, unseen, collectedCount, markAllSeen } = useStamps();
  const [sido, setSido] = useState(SIDO_ORDER[0] ?? '서울');
  const [city, setCity] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string[] | null>(null);
  const [animateIds, setAnimateIds] = useState<Set<string>>(() => new Set());
  const [replayNonce, setReplayNonce] = useState<Record<string, number>>({});
  const [showScanIntro, setShowScanIntro] = useState(
    () => !getStampsScanIntroSeen(),
  );
  const [mapOpen, setMapOpen] = useState(false);
  const celebratedIds = useRef(new Set<string>());
  const celebrating = useRef(false);

  const onScanIntroConfirm = useCallback(() => {
    setStampsScanIntroSeen();
    setShowScanIntro(false);
  }, []);

  useEffect(() => {
    setCity(null);
  }, [sido]);

  useEffect(() => {
    if (celebrating.current || unseen.length === 0) {
      return;
    }
    const fresh = unseen.filter((id) => !celebratedIds.current.has(id));
    if (fresh.length === 0) {
      markAllSeen();
      return;
    }

    celebrating.current = true;
    for (const id of fresh) {
      celebratedIds.current.add(id);
    }

    const ids = new Set<string>();
    const names: string[] = [];
    for (const id of fresh) {
      const entry = collected[id];
      if (!entry) {
        continue;
      }
      ids.add(id);
      if (!names.includes(entry.name)) {
        names.push(entry.name);
      }
    }

    markAllSeen();

    if (ids.size > 0) {
      setAnimateIds(ids);
      setCelebrate(names.slice(0, 5));
      const firstId = fresh[0];
      const first = firstId ? collected[firstId] : undefined;
      if (first?.sido) {
        setSido(first.sido);
      }
      if (first?.city) {
        setCity(first.city);
      }
    } else {
      celebrating.current = false;
    }
  }, [collected, markAllSeen, unseen]);

  const onOverlayDone = useCallback(() => {
    setCelebrate(null);
    celebrating.current = false;
  }, []);

  const onReplayStamp = useCallback((id: string) => {
    setReplayNonce((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const cities = useMemo(() => cityListForSido(sido), [sido]);
  const collectedInSido = countCollectedInSido(collected, sido);
  const monthFirsts = firstsInMonth(collected, month);

  const cityRows: CityRow[] = useMemo(
    () =>
      cities.map((c) => {
        const total = dongListForCity(sido, c).length;
        return {
          city: c,
          collected: countCollectedInCity(collected, sido, c),
          total,
        };
      }),
    [cities, collected, sido],
  );

  const progressTotal = useMemo(
    () => cities.reduce((n, c) => n + dongListForCity(sido, c).length, 0),
    [cities, sido],
  );
  const progressPct =
    progressTotal === 0
      ? 0
      : Math.min(100, (collectedInSido / progressTotal) * 100);

  const dongSection: CityStampSection | null = useMemo(() => {
    if (!city) {
      return null;
    }
    const dongs = dongListForCity(sido, city);
    const units = dongs.map((name) => {
      const id = stampId(sido, city, name);
      return {
        id,
        name,
        collected: Boolean(collected[id]),
        animateIn: animateIds.has(id),
        tiltDeg: tiltForName(name),
      };
    });
    // Visited first so progress is obvious at a glance.
    units.sort((a, b) => {
      if (a.collected !== b.collected) {
        return a.collected ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ko');
    });
    return {
      city,
      grouped: true,
      showHeader: false,
      collected: countCollectedInCity(collected, sido, city),
      total: dongs.length,
      units,
    };
  }, [animateIds, city, collected, sido]);

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <LoadingView message={strings.stamps.loading} />
      </SafeAreaView>
    );
  }

  const empty = collectedCount === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PaperGrain style={styles.grain} />
      <StampScanIntroModal
        visible={showScanIntro}
        onConfirm={onScanIntroConfirm}
      />

      {celebrate && celebrate.length > 0 ? (
        <StampEarnOverlay names={celebrate} onDone={onOverlayDone} />
      ) : null}

      <ScreenHeader
        title={strings.stamps.title}
        onBack={city ? () => setCity(null) : undefined}
        trailing={
          <View style={styles.trailing}>
            {monthFirsts > 0 ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {strings.stamps.newThisMonth(monthFirsts)}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => setMapOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={strings.stamps.mapOpen}
              style={({ pressed }) => [
                styles.mapBtn,
                pressed && styles.mapBtnPressed,
              ]}
            >
              <MapIcon color={theme.colors.ink} />
            </Pressable>
          </View>
        }
      />

      <StampMapModal
        visible={mapOpen}
        collected={collected}
        onClose={() => setMapOpen(false)}
        onSelectSido={(next) => {
          setSido(next);
          setCity(null);
        }}
      />

      {!city ? (
        <RegionChips sidos={SIDO_ORDER} selected={sido} onSelect={setSido} />
      ) : null}

      <View style={styles.progressBlock}>
        <Text style={styles.progressLabel}>
          {city
            ? strings.stamps.cityProgressLabel(city)
            : strings.stamps.progressLabel(sido)}
          {city && dongSection
            ? strings.stamps.progress(dongSection.collected, dongSection.total)
            : strings.stamps.progress(collectedInSido, progressTotal)}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${
                  city && dongSection
                    ? dongSection.total === 0
                      ? 0
                      : Math.min(
                          100,
                          (dongSection.collected / dongSection.total) * 100,
                        )
                    : progressPct
                }%`,
              },
            ]}
          />
        </View>
        {syncing ? (
          <Text style={styles.syncHint}>{strings.stamps.backfilling}</Text>
        ) : null}
      </View>

      {empty && !city ? (
        <View style={styles.emptyWrap}>
          <MascotPin size={48} />
          <StateView
            title={
              syncing ? strings.stamps.backfilling : strings.stamps.emptyTitle
            }
            description={
              syncing ? strings.stamps.scanIntroBody : strings.stamps.empty
            }
          />
        </View>
      ) : city && dongSection ? (
        <CityStampSections
          sections={[dongSection]}
          replayNonce={replayNonce}
          onReplay={onReplayStamp}
        />
      ) : (
        <ScrollView>
          <CityList cities={cityRows} onSelect={setCity} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  grain: {
    opacity: 0.3,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  mapBtnPressed: {
    opacity: 0.7,
  },
  pill: {
    backgroundColor: theme.colors.ink,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  pillText: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.surface,
    fontWeight: '700',
  },
  progressBlock: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 6,
  },
  progressLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  syncHint: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
});
