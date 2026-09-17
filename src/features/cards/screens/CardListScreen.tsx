import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button } from '@/shared/components/Button';
import { CreateCardFab } from '@/shared/components/CreateCardFab';
import { LoadProgressBanner } from '@/shared/components/LoadProgressBanner';
import { LoadingView } from '@/shared/components/LoadingView';
import { PaperGrain } from '@/shared/components/PaperGrain';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';
import { useDarkMode, useTheme } from '@/shared/theme/ThemeProvider';

import { RecapBoard } from '../components/RecapBoard';
import { RecapPhotosModal } from '../components/RecapPhotosModal';
import { useCards, useDeleteCards } from '../hooks/useCards';
import { useMonthCover } from '../hooks/useMonthCover';
import type { RecapCard } from '../types';
import { summaryTopPlaces } from '../utils/summaryTopPlaces';
import { AssetThumbImage } from '../../photos/components/AssetThumbImage';
import { HomeNavBar } from '../../photos/components/HomeNavBar';
import { APP_NAV_ITEMS } from '../../photos/constants/appNav';
import { useCurrentMonth } from '../../photos/hooks/useCurrentMonth';
import { useMonthJourney } from '../../photos/hooks/useMonthJourney';
import { useMonthLoadProgress } from '../../photos/hooks/useMonthLoadProgress';
import { useMonthlyPhotos } from '../../photos/hooks/useMonthlyPhotos';
import { usePinCovers } from '../../photos/hooks/usePinCovers';
import type { PhotoRef } from '../../photos/types';

type RecapTab = 'summary' | 'place' | 'photo';

const TABS: { id: RecapTab; label: string }[] = [
  { id: 'summary', label: strings.cards.boardSummary },
  { id: 'place', label: strings.cards.boardPlace },
  { id: 'photo', label: strings.cards.boardDay },
];

const TOP_PLACE_LIMIT = 4;
const PLACE_CARD_SIZE = 132;

function monthNumOf(month: string): number {
  return Number(month.slice(5, 7)) || 1;
}

function monthHeading(month: string): string {
  const [y, m] = month.split('-');
  if (!y || !m) {
    return month;
  }
  return `${y}년 ${Number(m)}월`;
}

function StatPinIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M12 2c-3.3 0-6 2.6-6 5.9 0 4.4 6 11.1 6 11.1s6-6.7 6-11.1C18 4.6 15.3 2 12 2zm0 8.1a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4z"
        fill={color}
      />
    </Svg>
  );
}

function StatPhotoIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M20 5h-3.2l-1.4-1.8A2 2 0 0 0 13.8 2h-3.6a2 2 0 0 0-1.6.8L7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-8 12.2A4.2 4.2 0 1 1 16.2 13 4.2 4.2 0 0 1 12 17.2z"
        fill={color}
      />
    </Svg>
  );
}

function ExpandIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function CardListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const insets = useSafeAreaInsets();
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const { colors } = useTheme();
  const { enabled: dark } = useDarkMode();
  const { data, isPending, isError, refetch } = useCards();
  const deleteCards = useDeleteCards();
  const showLoading = useHeldBusy(isPending);
  const { month } = useCurrentMonth();
  const monthQuery = useMonthlyPhotos(month);
  const loadProgress = useMonthLoadProgress();
  const monthPhotos = monthQuery.data?.photos ?? [];
  /** Total album rows for the month (GPS + no-GPS) — count chip only. */
  const monthPhotoCount = monthQuery.data?.displayPhotos?.length ?? 0;
  const { visitPlaces } = useMonthJourney(monthPhotos, {
    resetKey: month,
  });
  const { covers: pinCovers } = usePinCovers(month);
  const { coverAssetId: monthCoverId, setCover: setMonthCover } =
    useMonthCover(month);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<RecapTab>(
    modeParam === 'day' ? 'photo' : 'summary',
  );
  const [viewerPhotos, setViewerPhotos] = useState<PhotoRef[] | null>(null);
  const [viewerCoverId, setViewerCoverId] = useState<string | null>(null);
  /** Only hero opens the modal with month-cover "대표로 쓰기". */
  const [viewerSetsMonthCover, setViewerSetsMonthCover] = useState(false);

  const heroId = useMemo(() => {
    if (
      monthCoverId &&
      monthPhotos.some((photo) => photo.assetId === monthCoverId)
    ) {
      return monthCoverId;
    }
    return monthPhotos[0]?.assetId ?? null;
  }, [monthCoverId, monthPhotos]);

  const topPlaces = useMemo(
    () =>
      summaryTopPlaces(monthPhotos, visitPlaces, pinCovers, TOP_PLACE_LIMIT),
    [monthPhotos, visitPlaces, pinCovers],
  );

  const openViewer = useCallback(
    (
      photos: PhotoRef[],
      coverAssetId?: string | null,
      opts?: { setMonthCover?: boolean },
    ) => {
      if (photos.length === 0) {
        return;
      }
      setViewerPhotos(photos);
      setViewerCoverId(coverAssetId ?? photos[0]?.assetId ?? null);
      setViewerSetsMonthCover(opts?.setMonthCover === true);
    },
    [],
  );

  const closeViewer = useCallback(() => {
    setViewerPhotos(null);
    setViewerCoverId(null);
    setViewerSetsMonthCover(false);
  }, []);

  const onSetViewerMonthCover = useCallback(
    (assetId: string) => {
      setMonthCover(assetId);
      setViewerCoverId(assetId);
    },
    [setMonthCover],
  );

  /**
   * Pop back to home (native back animation). `replace('/')` slides home in
   * from the right like a forward push — feels wrong for a back control.
   * dismissTo clears create/preview leftovers still on the stack.
   */
  const goHome = () => {
    router.dismissTo('/');
  };

  const exitEdit = useCallback(() => {
    setEditing(false);
    setSelectedIds(new Set());
  }, []);

  const openArchive = useCallback(() => {
    setArchiveOpen(true);
    setEditing(false);
    setSelectedIds(new Set());
  }, []);

  const closeArchive = useCallback(() => {
    setArchiveOpen(false);
    setEditing(false);
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    if (!archiveOpen) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeArchive();
      return true;
    });
    return () => sub.remove();
  }, [archiveOpen, closeArchive]);

  const enterEdit = useCallback(() => {
    setEditing(true);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!data) {
      return;
    }
    setSelectedIds(new Set(data.map((card) => card.id)));
  }, [data]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const confirmDelete = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      Alert.alert(
        strings.cards.deleteConfirmTitle,
        strings.cards.deleteConfirmMessage(ids.length),
        [
          { text: strings.common.cancel, style: 'cancel' },
          {
            text: strings.cards.delete,
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await deleteCards.mutateAsync(ids);
                  exitEdit();
                } catch (error) {
                  console.error('deleteCards failed', error);
                  Alert.alert(strings.common.error);
                }
              })();
            },
          },
        ],
      );
    },
    [deleteCards, exitEdit],
  );

  const onRowPress = useCallback(
    (card: RecapCard) => {
      if (editing) {
        toggleSelect(card.id);
        return;
      }
      router.push(`/cards/${card.id}`);
    },
    [editing, router, toggleSelect],
  );

  const onRowLongPress = useCallback(
    (card: RecapCard) => {
      if (editing) {
        return;
      }
      setEditing(true);
      setSelectedIds(new Set([card.id]));
    },
    [editing],
  );

  if (showLoading) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.cards.listTitle} onBack={goHome} />
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
        <HomeNavBar items={APP_NAV_ITEMS} />
      </SafeAreaView>
    );
  }

  const allSelected = data.length > 0 && selectedIds.size === data.length;
  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
      {dark ? null : <PaperGrain style={styles.grain} />}
      <ScreenHeader
        title={
          archiveOpen ? strings.cards.listArchive : strings.cards.listTitle
        }
        onBack={archiveOpen ? closeArchive : goHome}
        trailing={
          archiveOpen ? (
            data.length > 0 ? (
              <Pressable
                onPress={editing ? exitEdit : enterEdit}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  editing ? strings.cards.listDone : strings.cards.listEdit
                }
              >
                <Text style={[styles.headerAction, shell.ink]}>
                  {editing ? strings.cards.listDone : strings.cards.listEdit}
                </Text>
              </Pressable>
            ) : null
          ) : (
            <Pressable
              onPress={openArchive}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={strings.cards.listArchive}
            >
              <Text style={[styles.headerAction, shell.ink]}>
                {strings.cards.listArchive}
              </Text>
            </Pressable>
          )
        }
      />

      {archiveOpen && editing && data.length > 0 ? (
        <View style={styles.selectBar}>
          <Pressable
            onPress={allSelected ? deselectAll : selectAll}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Text style={[styles.selectBarAction, shell.ink]}>
              {allSelected
                ? strings.cards.deselectAll
                : strings.cards.selectAll}
            </Text>
          </Pressable>
          <Text style={[styles.selectBarCount, shell.soft]}>
            {selectedCount > 0
              ? strings.cards.deleteSelected(selectedCount)
              : ' '}
          </Text>
        </View>
      ) : null}

      {archiveOpen ? (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[styles.cardsEmpty, shell.soft]}>
              {strings.cards.listEmpty}
            </Text>
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.id);
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.shellChip,
                    borderColor: 'transparent',
                  },
                  selected && styles.cardSelected,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => onRowPress(item)}
                onLongPress={() => onRowLongPress(item)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityState={editing ? { selected } : undefined}
              >
                {editing ? (
                  <View
                    style={[styles.check, selected && styles.checkOn]}
                    accessibilityElementsHidden
                  >
                    {selected ? (
                      <Text style={styles.checkMark}>✓</Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.rowText}>
                  <Text style={[styles.title, shell.ink]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.meta, shell.soft]}>
                    {item.month} ·{' '}
                    {item.template === 'story'
                      ? strings.cards.templateStory
                      : strings.cards.templateFeed}
                  </Text>
                </View>
                {!editing ? (
                  <Text style={[styles.chevron, shell.subtle]}>›</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      ) : (
        <>
          <Text style={[styles.monthHeading, shell.ink]}>
            {monthHeading(month)}
          </Text>
          <View style={styles.tabs}>
            {TABS.map((item) => {
              const on = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setTab(item.id)}
                  style={styles.tabBtn}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      shell.subtle,
                      on && styles.tabLabelOn,
                      on && shell.ink,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {on ? <View style={styles.tabUnderline} /> : null}
                </Pressable>
              );
            })}
          </View>
          <ScrollView contentContainerStyle={styles.boardScroll}>
            {monthQuery.isPending && monthPhotoCount === 0 ? (
              <LoadProgressBanner
                label={
                  loadProgress.total > 0 && loadProgress.month === month
                    ? strings.cards.loadingPhotos(
                        loadProgress.done,
                        loadProgress.total,
                      )
                    : strings.cards.loadingAlbum
                }
                done={loadProgress.month === month ? loadProgress.done : 0}
                total={loadProgress.month === month ? loadProgress.total : 0}
              />
            ) : tab === 'summary' ? (
              <View style={styles.summary}>
                <Pressable
                  onPress={() =>
                    openViewer(monthPhotos, heroId, { setMonthCover: true })
                  }
                  disabled={!heroId}
                  style={styles.hero}
                  accessibilityRole="button"
                  accessibilityLabel={strings.cards.expandPhoto}
                >
                  {heroId ? (
                    <AssetThumbImage
                      assetId={heroId}
                      size={720}
                      style={styles.heroImg}
                    />
                  ) : (
                    <View style={styles.heroEmpty} />
                  )}
                  <View style={styles.heroCopy} pointerEvents="none">
                    <Text style={styles.heroTitle}>
                      {strings.cards.journeyTitle(monthNumOf(month))}
                    </Text>
                  </View>
                  {heroId ? (
                    <View style={styles.heroExpand} pointerEvents="none">
                      <ExpandIcon color={theme.colors.white} />
                    </View>
                  ) : null}
                </Pressable>

                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <StatPinIcon color={colors.shellSubtle} />
                    <View style={styles.statText}>
                      <Text style={[styles.statNum, shell.ink]}>
                        {visitPlaces.length}
                      </Text>
                      <Text style={[styles.statLabel, shell.soft]}>
                        {strings.cards.statPlaces}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <StatPhotoIcon color={colors.shellSubtle} />
                    <View style={styles.statText}>
                      <Text style={[styles.statNum, shell.ink]}>
                        {monthPhotoCount}
                      </Text>
                      <Text style={[styles.statLabel, shell.soft]}>
                        {strings.cards.statPhotos}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.topPlaces}>
                  <View style={styles.topPlacesHead}>
                    <Text style={[styles.sectionTitle, shell.ink]}>
                      {strings.cards.topPlacesTitle}
                    </Text>
                    <Pressable
                      onPress={() => setTab('place')}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={strings.cards.topPlacesViewAll}
                    >
                      <Text style={[styles.viewAll, shell.soft]}>
                        {strings.cards.topPlacesViewAll} ›
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.topPlacesHint, shell.soft]}>
                    {strings.cards.topPlacesHint}
                  </Text>
                  {topPlaces.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.topPlaceRow}
                    >
                      {topPlaces.map((place) => {
                        return (
                          <View key={place.identity} style={styles.topPlaceCard}>
                            <Pressable
                              onPress={() =>
                                openViewer(place.photos, place.coverAssetId)
                              }
                              style={styles.topPlaceThumb}
                              accessibilityRole="button"
                              accessibilityLabel={strings.cards.expandPhoto}
                            >
                              <AssetThumbImage
                                assetId={place.coverAssetId}
                                size={256}
                                style={styles.topPlaceImg}
                              />
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                openViewer(place.photos, place.coverAssetId)
                              }
                              accessibilityRole="button"
                              accessibilityLabel={`${place.label}, ${strings.months.photoCount(place.photoCount)}`}
                            >
                              <Text
                                style={[styles.topPlaceLabel, shell.ink]}
                                numberOfLines={1}
                              >
                                {place.label}
                              </Text>
                              <Text
                                style={[styles.topPlaceMeta, shell.soft]}
                                numberOfLines={1}
                              >
                                {strings.cards.topPlaceMeta(place.photoCount)}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </ScrollView>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => router.push('/cards/create')}
                  style={({ pressed }) => [
                    styles.leaveCta,
                    { backgroundColor: colors.shellChip },
                    pressed && styles.leaveCtaPressed,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.leaveCtaText, shell.ink]}>
                    {strings.cards.leaveMonth}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <RecapBoard
                key={tab}
                month={month}
                photos={monthPhotos}
                visitPlaces={visitPlaces}
                mode={tab === 'photo' ? 'day' : 'place'}
              />
            )}
          </ScrollView>
        </>
      )}

      <RecapPhotosModal
        photos={viewerPhotos}
        coverAssetId={viewerCoverId}
        onSetCover={viewerSetsMonthCover ? onSetViewerMonthCover : undefined}
        onClose={closeViewer}
      />

      {editing ? (
        <View style={styles.footer}>
          <Button
            title={
              selectedCount > 0
                ? strings.cards.deleteSelected(selectedCount)
                : strings.cards.delete
            }
            variant="accent"
            disabled={selectedCount === 0 || deleteCards.isPending}
            onPress={() => confirmDelete([...selectedIds])}
          />
        </View>
      ) : archiveOpen ? (
        <View
          style={[
            styles.fabWrap,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
          ]}
          pointerEvents="box-none"
        >
          <CreateCardFab onPress={() => router.push('/cards/create')} />
        </View>
      ) : null}

      {!archiveOpen && !editing ? <HomeNavBar items={APP_NAV_ITEMS} /> : null}
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
  headerAction: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.terracotta,
    fontWeight: '700',
  },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  selectBarAction: {
    ...theme.type.label,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  selectBarCount: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 88,
  },
  boardScroll: {
    paddingBottom: 88,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  cardSelected: {
    borderColor: theme.colors.terracotta,
    backgroundColor: theme.colors.terracottaSoft,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  checkOn: {
    borderColor: theme.colors.terracotta,
    backgroundColor: theme.colors.terracotta,
  },
  checkMark: {
    color: theme.colors.surface,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  meta: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  chevron: {
    color: theme.colors.subtle,
    fontSize: 26,
    fontWeight: '400',
    marginLeft: theme.spacing.sm,
  },
  sep: {
    height: theme.spacing.sm,
  },
  cardsEmpty: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  fabWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: theme.spacing.md,
  },
  monthHeading: {
    fontFamily: theme.fonts.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  tabBtn: {
    paddingBottom: 6,
  },
  tabLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  tabLabelOn: {
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 4,
    height: 2,
    width: 18,
    backgroundColor: theme.colors.ink,
    borderRadius: 1,
  },
  summary: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  hero: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 220,
    backgroundColor: theme.colors.surfaceAlt,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroEmpty: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  heroCopy: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: theme.spacing.md,
    backgroundColor: 'rgba(51,71,91,0.28)',
  },
  heroTitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: theme.colors.white,
  },
  heroExpand: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(51,71,91,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.panelBorder,
    marginHorizontal: theme.spacing.sm,
  },
  statText: {
    gap: 1,
  },
  statNum: {
    fontFamily: theme.fonts.sans,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  topPlaces: {
    gap: theme.spacing.xs,
  },
  topPlacesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  viewAll: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  topPlacesHint: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: theme.spacing.sm,
  },
  topPlaceRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  topPlaceCard: {
    width: PLACE_CARD_SIZE,
    gap: 6,
  },
  topPlaceThumb: {
    width: PLACE_CARD_SIZE,
    height: PLACE_CARD_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  topPlaceImg: {
    width: '100%',
    height: '100%',
  },
  topPlaceLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  topPlaceMeta: {
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  leaveCta: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
  },
  leaveCtaPressed: {
    opacity: 0.75,
  },
  leaveCtaText: {
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
