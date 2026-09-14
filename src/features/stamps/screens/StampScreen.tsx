import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

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

import { currentMonthKey } from '@/features/photos/utils/month';
import { usePhotoPermission } from '@/features/photos/hooks/usePhotoPermission';

import { type CityRow } from '../components/CityList';
import {
  CityStampSections,
  type CityStampSection,
  type CityStampUnit,
} from '../components/CityStampSections';
import { StampBookHome } from '../components/StampBookHome';
import { StampDongPhotosModal } from '../components/StampDongPhotosModal';
import { StampEarnOverlay } from '../components/StampEarnOverlay';
import { StampIndexingGate } from '../components/StampIndexingGate';
import { StampPager } from '../components/StampPager';
import { StampRegionDetail } from '../components/StampRegionDetail';
import { StampScanIntroModal } from '../components/StampScanIntroModal';
import { HomeNavBar } from '@/features/photos/components/HomeNavBar';
import { APP_NAV_ITEMS } from '@/features/photos/constants/appNav';
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
import { sidoFormal } from '../utils/sidoLabels';
import type { StampsCollected } from '../types';

function tiltForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 17;
  }
  return h - 8;
}

const CITY_SORT: CityListSort = 'name';

function cityRowsForSido(
  sido: string,
  collected: StampsCollected,
  sort: CityListSort = CITY_SORT,
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
      // Earn overlay is the celebration — mass grid slam janks on many NEW.
      animateIn: false,
      tiltDeg: tiltForName(name),
      firstMonth: entry?.firstMonth,
    };
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

/**
 * 발도장 — 시·도 스탬프북 → L1(구·시·군) → L2(동 / 읍·면).
 */
export function StampScreen() {
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const navigation = useNavigation();
  const router = useRouter();
  const { isReady, status: permissionStatus } = usePhotoPermission();
  const { syncing } = useStampLibrarySync({
    isReady,
    status: permissionStatus,
  });
  const indexing = useStampLibraryProgress();
  const gateOpen = syncing;

  const { collected, unseen, markAllSeen } = useStamps();
  const [sido, setSido] = useState(SIDO_ORDER[0] ?? '서울');
  const [l1Key, setL1Key] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string[] | null>(null);
  const [replayNonce, setReplayNonce] = useState<Record<string, number>>({});
  const [showScanIntro, setShowScanIntro] = useState(
    () => !getStampsScanIntroSeen(),
  );
  /** Stamp book → 시·도 detail (L1 grid). */
  const [sidoListOpen, setSidoListOpen] = useState(false);
  const [dongPhotos, setDongPhotos] = useState<StampDongPhotosQuery | null>(
    null,
  );
  const celebratedIds = useRef(new Set<string>());
  const celebrating = useRef(false);
  const pendingFocusRef = useRef<{ sido: string; l1Key: string | null } | null>(
    null,
  );

  const visitedSidoCount = useMemo(() => {
    const set = new Set<string>();
    for (const entry of Object.values(collected)) {
      if (entry?.sido) {
        set.add(entry.sido);
      }
    }
    return set.size;
  }, [collected]);

  useEffect(() => {
    if (!gateOpen) {
      return;
    }
    setDongPhotos(null);
  }, [gateOpen]);

  // After earn overlay / unseen settle — don't fight first paint with PIP.
  useEffect(() => {
    if (!isReady || gateOpen || celebrate != null || unseen.length > 0) {
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => {
      void prebuildStampDongPhotoIndex();
    });
    return () => task.cancel();
  }, [celebrate, gateOpen, isReady, unseen.length]);

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
    if (l1Key) {
      setL1Key(null);
      return true;
    }
    if (sidoListOpen) {
      setSidoListOpen(false);
      return true;
    }
    return false;
  }, [dongPhotos, l1Key, sidoListOpen]);

  const popStampLayerRef = useRef(popStampLayer);
  popStampLayerRef.current = popStampLayer;
  const nestedBack =
    Boolean(l1Key) || dongPhotos != null || sidoListOpen;

  /** Deep link / cold open of /stamps has no stack — bare GO_BACK warns in dev. */
  const leaveStampScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  }, [router]);

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
          leaveStampScreen();
        }),
    [leaveStampScreen],
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

    const names: string[] = [];
    for (const id of fresh) {
      const entry = collected[id];
      if (!entry) {
        continue;
      }
      if (!names.includes(entry.name)) {
        names.push(entry.name);
      }
    }

    markAllSeen();

    const firstId = fresh[0];
    const first = firstId ? collected[firstId] : undefined;
    const unit =
      first?.sido && first.city && first.name
        ? findL1ForStamp(first.sido, first.city, first.name)
        : null;
    const focus =
      first?.sido != null
        ? { sido: first.sido, l1Key: unit?.key ?? null }
        : null;

    if (names.length > 0) {
      pendingFocusRef.current = focus;
      setCelebrate(names.slice(0, 5));
    } else if (focus) {
      setSido(focus.sido);
      setSidoListOpen(true);
      setL1Key(focus.l1Key);
      celebrating.current = false;
    } else {
      celebrating.current = false;
    }
  }, [collected, markAllSeen, unseen]);

  const onOverlayDone = useCallback(() => {
    const focus = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (focus) {
      setSido(focus.sido);
      setSidoListOpen(true);
      setL1Key(focus.l1Key);
    }
    setCelebrate(null);
    celebrating.current = false;
  }, []);

  const openSidoList = useCallback((next: string) => {
    setSido(next);
    setSidoListOpen(true);
  }, []);

  const onReplayStamp = useCallback((id: string) => {
    setReplayNonce((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  const openDongPhotos = useCallback(
    (unit: CityStampUnit, stampCity: string) => {
      if (unit.collected) {
        onReplayStamp(unit.id);
      }
      setDongPhotos({
        sido,
        city: stampCity,
        leaf: unit.name,
      });
    },
    [onReplayStamp, sido],
  );

  const l1Rows = useMemo(
    () => cityRowsForSido(sido, collected),
    [collected, sido],
  );
  const l1UnitByKey = useMemo(() => {
    const map = new Map<string, StampL1Unit>();
    for (const unit of l1Units) {
      map.set(unit.key, unit);
    }
    return map;
  }, [l1Units]);
  const l1Index = Math.max(
    0,
    l1Rows.findIndex((row) => row.key === l1Key),
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
  const renderL1Page = useCallback(
    (row: CityRow) => {
      const unit = l1UnitByKey.get(row.key);
      if (!unit) {
        return null;
      }
      const section = leafSectionForUnit(sido, unit, collected);
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
          onSelectUnit={(stamp) => openDongPhotos(stamp, unit.stampCity)}
        />
      );
    },
    [collected, l1UnitByKey, openDongPhotos, replayNonce, sido],
  );

  const visitedL1Count = useMemo(
    () => l1Rows.filter((r) => r.collected > 0).length,
    [l1Rows],
  );

  const leafSection: CityStampSection | null = useMemo(() => {
    if (!selectedL1) {
      return null;
    }
    return leafSectionForUnit(sido, selectedL1, collected);
  }, [collected, selectedL1, sido]);

  const pagerTick = useMemo(
    () => [collected, replayNonce] as const,
    [collected, replayNonce],
  );
  const showBootLoading = useHeldBusy(!isReady, 1500);

  const headerTitle = l1Key
    ? selectedL1?.label ?? strings.stamps.title
    : sidoListOpen
      ? sidoFormal(sido)
      : strings.stamps.title;

  if (showBootLoading) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        <LoadingView message={strings.stamps.loading} />
      </SafeAreaView>
    );
  }

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
        title={headerTitle}
        onBack={
          nestedBack && !gateOpen ? popStampLayer : leaveStampScreen
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

          {!sidoListOpen && !l1Key ? (
            <ScrollView
              style={styles.pageScroll}
              contentContainerStyle={styles.homeScroll}
              showsVerticalScrollIndicator={false}
            >
              <StampBookHome
                sidos={SIDO_ORDER}
                collected={collected}
                visitedSidoCount={visitedSidoCount}
                onSelectSido={openSidoList}
              />
            </ScrollView>
          ) : l1Key ? (
            <>
              {leafSection ? (
                <View style={styles.leafHint}>
                  <Text style={[styles.leafHintText, shell.soft]} numberOfLines={1}>
                    {strings.stamps.leafVisitSummary(
                      leafSection.collected,
                      Math.max(0, leafSection.total - leafSection.collected),
                    )}
                  </Text>
                </View>
              ) : null}
              <StampPager
                data={l1Rows}
                index={l1Index}
                onIndexChange={onL1Page}
                keyExtractor={(row) => row.key}
                renderPage={renderL1Page}
                extraData={pagerTick}
              />
            </>
          ) : (
            <StampRegionDetail
              sido={sido}
              collected={collected}
              cities={l1Rows}
              visitedL1={visitedL1Count}
              onSelectCity={setL1Key}
            />
          )}
        </>
      )}

      {!gateOpen && !dongPhotos ? (
        <GestureDetector gesture={edgeBack}>
          <View style={styles.edgeBack} />
        </GestureDetector>
      ) : null}
      {!gateOpen ? <HomeNavBar items={APP_NAV_ITEMS} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  grain: {
    opacity: 0.28,
  },
  homeScroll: {
    paddingBottom: 96,
  },
  leafHint: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  leafHintText: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
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
