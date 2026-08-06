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
import { stampId } from '../services/dongIndex';
import {
  SIDO_ORDER,
  countCollectedInLeaves,
  findL1ForStamp,
  l1UnitsForSido,
  l2LeavesForUnit,
  type StampL1Unit,
} from '../services/stampNavIndex';
import { firstsInMonth } from '../services/stampsStorage';

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
 * 발도장 — 시·도 → L1(구·시·군) → L2(동 / 읍·면).
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
  const [l1Key, setL1Key] = useState<string | null>(null);
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
    setL1Key(null);
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

  const monthFirsts = firstsInMonth(collected, month);

  const leavesByL1 = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const unit of l1Units) {
      map.set(unit.key, l2LeavesForUnit(sido, unit));
    }
    return map;
  }, [l1Units, sido]);

  const l1Rows: CityRow[] = useMemo(
    () =>
      l1Units.map((unit) => {
        const leaves = leavesByL1.get(unit.key) ?? [];
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
      }),
    [collected, l1Units, leavesByL1, sido],
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
    const leaves = leavesByL1.get(selectedL1.key) ?? [];
    const units = leaves.map((name) => {
      const id = stampId(sido, selectedL1.stampCity, name);
      return {
        id,
        name,
        collected: Boolean(collected[id]),
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
      city: selectedL1.label,
      grouped: true,
      showHeader: false,
      collected: countCollectedInLeaves(
        collected,
        sido,
        selectedL1.stampCity,
        leaves,
      ),
      total: leaves.length,
      units,
    };
  }, [animateIds, collected, leavesByL1, selectedL1, sido]);

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
        onBack={l1Key ? () => setL1Key(null) : undefined}
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
          setL1Key(null);
        }}
      />

      {!l1Key ? (
        <RegionChips sidos={SIDO_ORDER} selected={sido} onSelect={setSido} />
      ) : null}

      <View style={styles.progressBlock}>
        <Text style={styles.progressLabel}>
          {selectedL1
            ? strings.stamps.cityProgressLabel(selectedL1.label)
            : strings.stamps.progressLabel(sido)}
          {selectedL1 && leafSection
            ? strings.stamps.progress(leafSection.collected, leafSection.total)
            : strings.stamps.progress(sidoCollected, sidoTotal)}
        </Text>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
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
        {syncing ? (
          <Text style={styles.syncHint}>{strings.stamps.backfilling}</Text>
        ) : null}
      </View>

      {empty && !l1Key ? (
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
      ) : selectedL1 && leafSection ? (
        leafSection.total === 0 ? (
          <View style={styles.emptyWrap}>
            <StateView
              title={selectedL1.label}
              description={
                selectedL1.kind === 'gun'
                  ? strings.stamps.gunLeafListEmpty
                  : strings.stamps.leafListEmpty
              }
            />
          </View>
        ) : (
          <CityStampSections
            sections={[leafSection]}
            replayNonce={replayNonce}
            onReplay={onReplayStamp}
          />
        )
      ) : (
        <ScrollView>
          <CityList cities={l1Rows} onSelect={setL1Key} />
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
