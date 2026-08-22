import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation, useRouter } from 'expo-router';
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
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { currentMonthKey } from '@/features/photos/utils/month';
import { usePhotoPermission } from '@/features/photos/hooks/usePhotoPermission';

import { CityList, type CityRow } from '../components/CityList';
import {
  CityStampSections,
  type CityStampSection,
  type CityStampUnit,
} from '../components/CityStampSections';
import { MascotPin } from '../components/MascotPin';
import { RegionChips } from '../components/RegionChips';
import { StampDongPhotosModal } from '../components/StampDongPhotosModal';
import { StampEarnOverlay } from '../components/StampEarnOverlay';
import { StampIndexingGate } from '../components/StampIndexingGate';
import { StampMapModal } from '../components/StampMapModal';
import { StampPager } from '../components/StampPager';
import { StampScanIntroModal } from '../components/StampScanIntroModal';
import { useStampLibraryProgress } from '../hooks/useStampLibraryProgress';
import { useStampLibrarySync } from '../hooks/useStampLibrarySync';
import { useStamps } from '../hooks/useStamps';
import { stampId } from '../services/dongIndex';
import {
  SIDO_ORDER,
  countCollectedInLeaves,
  findL1ForStamp,
  l1UnitsForSido,
  l2LeavesForUnit,
  sortCityRows,
  type CityListSort,
  type StampL1Unit,
} from '../services/stampNavIndex';
import {
  prebuildStampDongPhotoIndex,
  type StampDongPhotosQuery,
} from '../services/stampDongPhotos';
import type { StampsCollected } from '../types';

function tiltForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 17;
  }
  return h - 8;
}

const CITY_SORTS: { id: CityListSort; label: string }[] = [
  { id: 'most', label: strings.stamps.sortMost },
  { id: 'least', label: strings.stamps.sortLeast },
  { id: 'name', label: strings.stamps.sortName },
];

function cityRowsForSido(
  sido: string,
  collected: StampsCollected,
  sort: CityListSort,
): CityRow[] {
  const rows = l1UnitsForSido(sido).map((unit) => {
    const leaves = l2LeavesForUnit(sido, unit);
    return {
      key: unit.key,
      label: unit.label,
      collected: countCollectedInLeaves(
        collected,
        sido,
        unit.stampCity,
        leaves,
      ),
      total: leaves.length,
    };
  });
  return sortCityRows(rows, sort);
}

function leafSectionForUnit(
  sido: string,
  unit: StampL1Unit,
  collected: StampsCollected,
  animateIds: Set<string>,
): CityStampSection {
  const leaves = l2LeavesForUnit(sido, unit);
  const thisMonth = currentMonthKey();
  const units = leaves.map((name) => {
    const id = stampId(sido, unit.stampCity, name);
    const entry = collected[id];
    return {
      id,
      name,
      collected: Boolean(entry),
      isNew: Boolean(entry) && entry.firstMonth === thisMonth,
      animateIn: animateIds.has(id),
      tiltDeg: tiltForName(name),
    };
  });
  units.sort((a, b) => {
    if (a.collected !== b.collected) {
      return a.collected ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'ko');
  });
  return {
    city: unit.label,
    grouped: true,
    showHeader: false,
    collected: countCollectedInLeaves(collected, sido, unit.stampCity, leaves),
    total: leaves.length,
    units,
  };
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
 * 발도장 — 시·도 → L1(구·시·군) → L2(동 / 읍·면).
 */
export function StampScreen() {
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const router = useRouter();
  const { isReady, status: permissionStatus } = usePhotoPermission();
  const { syncing } = useStampLibrarySync({
    isReady,
    status: permissionStatus,
  });
  const indexing = useStampLibraryProgress();
  const gateOpen = syncing;

  const { collected, unseen, collectedCount, markAllSeen } = useStamps();
  const [sido, setSido] = useState(SIDO_ORDER[0] ?? '서울');
  const [l1Key, setL1Key] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string[] | null>(null);
  const [animateIds, setAnimateIds] = useState<Set<string>>(() => new Set());
  const [replayNonce, setReplayNonce] = useState<Record<string, number>>({});
  const [showScanIntro, setShowScanIntro] = useState(
    () => !getStampsScanIntroSeen(),
  );
  const [citySort, setCitySort] = useState<CityListSort>('most');
  const [mapOpen, setMapOpen] = useState(false);
  const [dongPhotos, setDongPhotos] = useState<StampDongPhotosQuery | null>(
    null,
  );
  const celebratedIds = useRef(new Set<string>());
  const celebrating = useRef(false);

  useEffect(() => {
    if (!gateOpen) {
      return;
    }
    setMapOpen(false);
    setDongPhotos(null);
  }, [gateOpen]);

  // Warm leaf→photos index so the first 동 tap does not wait on full PIP.
  useEffect(() => {
    if (!isReady || gateOpen) {
      return;
    }
    void prebuildStampDongPhotoIndex();
  }, [gateOpen, isReady]);

  const onScanIntroConfirm = useCallback(() => {
    setStampsScanIntroSeen();
    setShowScanIntro(false);
  }, []);

  /** In-screen layers sit above the stamps route; native pop would skip to the map. */
  const popStampLayer = useCallback((): boolean => {
    if (dongPhotos) {
      setDongPhotos(null);
      return true;
    }
    if (mapOpen) {
      setMapOpen(false);
      return true;
    }
    if (l1Key) {
      setL1Key(null);
      return true;
    }
    return false;
  }, [dongPhotos, l1Key, mapOpen]);

  const popStampLayerRef = useRef(popStampLayer);
  popStampLayerRef.current = popStampLayer;
  const nestedBack = Boolean(l1Key) || mapOpen || dongPhotos != null;

  useEffect(() => {
    // Horizontal pager owns in-content swipes; left-edge back is custom.
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  useEffect(() => {
    const stop = navigation.addListener('beforeRemove', (e) => {
      if (!popStampLayerRef.current()) {
        return;
      }
      e.preventDefault();
    });
    return stop;
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (popStampLayerRef.current()) {
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const edgeBack = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX(16)
        .failOffsetY([-28, 28])
        .onEnd((e) => {
          if (e.translationX <= 56) {
            return;
          }
          if (popStampLayerRef.current()) {
            return;
          }
          if (router.canGoBack()) {
            router.back();
          }
        }),
    [router],
  );

  useEffect(() => {
    setL1Key((key) => {
      if (!key) {
        return null;
      }
      return l1UnitsForSido(sido).some((unit) => unit.key === key) ? key : null;
    });
  }, [sido]);

  const l1Units = useMemo(() => l1UnitsForSido(sido), [sido]);
  const selectedL1: StampL1Unit | null = useMemo(
    () => l1Units.find((u) => u.key === l1Key) ?? null,
    [l1Key, l1Units],
  );

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
      if (first?.sido && first.city && first.name) {
        const unit = findL1ForStamp(first.sido, first.city, first.name);
        if (unit) {
          setL1Key(unit.key);
        }
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

  const openDongPhotos = useCallback(
    (unit: CityStampUnit, stampCity: string) => {
      onReplayStamp(unit.id);
      setDongPhotos({
        sido,
        city: stampCity,
        leaf: unit.name,
      });
    },
    [onReplayStamp, sido],
  );

  const l1Rows = useMemo(
    () => cityRowsForSido(sido, collected, citySort),
    [citySort, collected, sido],
  );
  const l1UnitByKey = useMemo(() => {
    const map = new Map<string, StampL1Unit>();
    for (const unit of l1Units) {
      map.set(unit.key, unit);
    }
    return map;
  }, [l1Units]);
  const sidoIndex = Math.max(0, SIDO_ORDER.indexOf(sido));
  const l1Index = Math.max(
    0,
    l1Rows.findIndex((row) => row.key === l1Key),
  );

  const onSidoPage = useCallback(
    (index: number) => {
      const next = SIDO_ORDER[index];
      if (next) {
        setSido(next);
      }
    },
    [],
  );
  const onL1Page = useCallback(
    (index: number) => {
      const next = l1Rows[index];
      if (next) {
        setL1Key(next.key);
      }
    },
    [l1Rows],
  );
  const renderSidoPage = useCallback(
    (pageSido: string) => (
      <ScrollView style={styles.pageScroll} nestedScrollEnabled directionalLockEnabled>
        <CityList
          cities={cityRowsForSido(pageSido, collected, citySort)}
          onSelect={(key) => {
            setSido(pageSido);
            setL1Key(key);
          }}
        />
      </ScrollView>
    ),
    [citySort, collected],
  );
  const renderL1Page = useCallback(
    (row: CityRow) => {
      const unit = l1UnitByKey.get(row.key);
      if (!unit) {
        return null;
      }
      const section = leafSectionForUnit(sido, unit, collected, animateIds);
      if (section.total === 0) {
        return (
          <View style={styles.emptyWrap}>
            <StateView
              title={unit.label}
              description={
                unit.kind === 'gun'
                  ? strings.stamps.gunLeafListEmpty
                  : strings.stamps.leafListEmpty
              }
            />
          </View>
        );
      }
      return (
        <CityStampSections
          sections={[section]}
          replayNonce={replayNonce}
          onSelectCollected={(stamp) => openDongPhotos(stamp, unit.stampCity)}
        />
      );
    },
    [animateIds, collected, l1UnitByKey, openDongPhotos, replayNonce, sido],
  );

  const sidoCollected = useMemo(
    () => l1Rows.reduce((n, r) => n + r.collected, 0),
    [l1Rows],
  );
  const sidoTotal = useMemo(
    () => l1Rows.reduce((n, r) => n + r.total, 0),
    [l1Rows],
  );
  const progressPct =
    sidoTotal === 0 ? 0 : Math.min(100, (sidoCollected / sidoTotal) * 100);

  const leafSection: CityStampSection | null = useMemo(() => {
    if (!selectedL1) {
      return null;
    }
    return leafSectionForUnit(sido, selectedL1, collected, animateIds);
  }, [animateIds, collected, selectedL1, sido]);

  const pagerTick = useMemo(
    () => [collected, replayNonce, animateIds, citySort] as const,
    [animateIds, citySort, collected, replayNonce],
  );
  const showBootLoading = useHeldBusy(!isReady, 1500);

  if (showBootLoading) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        <LoadingView message={strings.stamps.loading} />
      </SafeAreaView>
    );
  }

  const empty = collectedCount === 0;

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
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
        onBack={
          gateOpen ? undefined : nestedBack ? popStampLayer : undefined
        }
        trailing={
          gateOpen ? null : (
            <Pressable
              onPress={() => setMapOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={strings.stamps.mapOpen}
              style={({ pressed }) => [
                styles.mapBtn,
                {
                  borderColor: colors.shellInk,
                  backgroundColor: colors.shellChip,
                },
                pressed && styles.mapBtnPressed,
              ]}
            >
              <MapIcon color={colors.shellInk} />
            </Pressable>
          )
        }
      />

      {gateOpen ? (
        <StampIndexingGate progress={indexing} />
      ) : (
        <>
          <StampDongPhotosModal
            query={dongPhotos}
            onClose={() => setDongPhotos(null)}
          />

          <StampMapModal
            visible={mapOpen}
            collected={collected}
            onClose={() => setMapOpen(false)}
          />

          {!l1Key ? (
            <RegionChips sidos={SIDO_ORDER} selected={sido} onSelect={setSido} />
          ) : null}

          <View style={styles.progressBlock}>
            <View style={styles.progressRow}>
              <Text
                style={[styles.progressLabel, shell.soft]}
                numberOfLines={1}
              >
                {selectedL1
                  ? strings.stamps.cityProgressLabel(selectedL1.label)
                  : strings.stamps.progressLabel(sido)}
                {selectedL1 && leafSection
                  ? strings.stamps.progress(
                      leafSection.collected,
                      leafSection.total,
                    )
                  : strings.stamps.progress(sidoCollected, sidoTotal)}
              </Text>
              {!l1Key ? (
                <View style={styles.sortRow}>
                  {CITY_SORTS.map((opt, i) => (
                    <View key={opt.id} style={styles.sortItem}>
                      {i > 0 ? (
                        <Text style={[styles.sortDot, shell.subtle]}>·</Text>
                      ) : null}
                      <Pressable
                        onPress={() => setCitySort(opt.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: citySort === opt.id }}
                        accessibilityLabel={opt.label}
                        hitSlop={8}
                        style={({ pressed }) => pressed && styles.sortPressed}
                      >
                        <Text
                          style={[
                            styles.sortText,
                            shell.subtle,
                            citySort === opt.id && styles.sortTextOn,
                            citySort === opt.id && shell.ink,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={[styles.track, { backgroundColor: shell.line }]}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: shell.fill,
                    width: `${
                      selectedL1 && leafSection
                        ? leafSection.total === 0
                          ? 0
                          : Math.min(
                              100,
                              (leafSection.collected / leafSection.total) * 100,
                            )
                        : progressPct
                    }%`,
                  },
                ]}
              />
            </View>
          </View>

          {empty && !l1Key ? (
            <View style={styles.emptyWrap}>
              <MascotPin size={48} />
              <StateView
                title={strings.stamps.emptyTitle}
                description={strings.stamps.empty}
              />
            </View>
          ) : l1Key ? (
            <StampPager
              data={l1Rows}
              index={l1Index}
              onIndexChange={onL1Page}
              keyExtractor={(row) => row.key}
              renderPage={renderL1Page}
              extraData={pagerTick}
            />
          ) : (
            <StampPager
              data={SIDO_ORDER}
              index={sidoIndex}
              onIndexChange={onSidoPage}
              keyExtractor={(name) => name}
              renderPage={renderSidoPage}
              extraData={pagerTick}
            />
          )}
        </>
      )}

      {!gateOpen && !mapOpen && !dongPhotos ? (
        <GestureDetector gesture={edgeBack}>
          <View style={styles.edgeBack} />
        </GestureDetector>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  grain: {
    opacity: 0.3,
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
  progressBlock: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  progressLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
    flexShrink: 1,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  sortText: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
  },
  sortTextOn: {
    fontWeight: '700',
  },
  sortDot: {
    ...theme.type.micro,
    marginHorizontal: 5,
  },
  sortPressed: {
    opacity: 0.5,
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
  pageScroll: {
    flex: 1,
  },
  edgeBack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 28,
    zIndex: 8,
  },
});
