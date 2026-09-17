import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { LoadingView } from '@/shared/components/LoadingView';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';

import { AssetThumbImage } from '../components/AssetThumbImage';
import { HomeNavBar } from '../components/HomeNavBar';
import { PhotoPreviewSheet } from '../components/PhotoPreviewSheet';
import { APP_NAV_ITEMS } from '../constants/appNav';
import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePinCovers } from '../hooks/usePinCovers';
import { startMonthThumbPrewarm } from '../services/monthImageWarmup';
import type { DisplayPhoto, PlaceCluster } from '../types';
import {
  buildDayTimeline,
  type DayTimelineSection,
} from '../utils/dayTimeline';
import { resolveClusterDetailLabel } from '../utils/placeJourney';

const RADIUS = 8;
/** Tight gutters — collage, not equal gallery tiles. */
const GUTTER = 4;
const SINGLE_PHOTO_MIN_HEIGHT = 180;
const SINGLE_PHOTO_MAX_HEIGHT = 220;
const JUMP_THUMB = 44;

function monthHeading(month: string): string {
  const [y, m] = month.split('-');
  if (!y || !m) {
    return month;
  }
  return `${y}년 ${Number(m)}월`;
}

function dayOfMonth(dayKey: string): number | null {
  const day = Number(dayKey.slice(-2));
  return Number.isInteger(day) && day > 0 ? day : null;
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3.5}
        y={5}
        width={17}
        height={15}
        rx={2.5}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M3.5 10h17M8 3.5v3M16 3.5v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

type DayThumb = {
  assetId: string;
  takenAt: string;
};

function Thumb({
  item,
  style,
  onOpen,
  decode,
  overlay,
}: {
  item: DayThumb;
  style: object;
  onOpen: (item: DayThumb) => void;
  decode: number;
  overlay?: string;
}) {
  return (
    <Pressable
      onPress={() => onOpen(item)}
      style={[styles.thumb, style]}
      accessibilityRole="button"
    >
      <AssetThumbImage
        assetId={item.assetId}
        size={decode}
        style={styles.thumbFill}
      />
      {overlay ? (
        <View style={styles.overflow}>
          <Text style={styles.overflowText}>{overlay}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Editorial collage — quiet days stay compact; 4+ days show 3 cells +N.
 * Tapping opens the day sheet with *all* photos for that date.
 */
function DayCollage({
  thumbs,
  width,
  onOpenAsset,
}: {
  thumbs: DayThumb[];
  width: number;
  onOpenAsset: (assetId: string) => void;
}) {
  const n = thumbs.length;
  if (n === 0) {
    return null;
  }

  const open = (item: DayThumb) => onOpenAsset(item.assetId);

  if (n === 1) {
    const h = Math.max(
      SINGLE_PHOTO_MIN_HEIGHT,
      Math.min(SINGLE_PHOTO_MAX_HEIGHT, Math.round(width * 0.62)),
    );
    return (
      <Thumb
        item={thumbs[0]!}
        style={{ width, height: h, borderRadius: RADIUS }}
        decode={Math.ceil(width * 2)}
        onOpen={open}
      />
    );
  }

  if (n === 2) {
    const w = (width - GUTTER) / 2;
    const h = Math.round(w * 0.8);
    return (
      <View style={[styles.row, { gap: GUTTER }]}>
        {thumbs.slice(0, 2).map((item) => (
          <Thumb
            key={item.assetId}
            item={item}
            style={{ width: w, height: h, borderRadius: RADIUS }}
            decode={Math.ceil(w * 2)}
            onOpen={open}
          />
        ))}
      </View>
    );
  }

  if (n === 3) {
    const w = (width - GUTTER * 2) / 3;
    const h = Math.round(w * 1.02);
    return (
      <View style={[styles.row, { gap: GUTTER }]}>
        {thumbs.map((item) => (
          <Thumb
            key={item.assetId}
            item={item}
            style={{ width: w, height: h, borderRadius: RADIUS }}
            decode={Math.ceil(w * 2)}
            onOpen={open}
          />
        ))}
      </View>
    );
  }

  // 4+: featured left + two stacked support; last cell shows +remaining.
  const leftW = Math.round((width - GUTTER) * 0.62);
  const rightW = width - GUTTER - leftW;
  const leftH = Math.round(leftW * 0.92);
  const featured = thumbs[0]!;
  const side = thumbs.slice(1, 3);
  const overflow = Math.max(0, thumbs.length - 3);
  const sideH = (leftH - GUTTER) / 2;

  return (
    <View style={[styles.row, { gap: GUTTER, height: leftH }]}>
      <Thumb
        item={featured}
        style={{ width: leftW, height: leftH, borderRadius: RADIUS }}
        decode={Math.ceil(leftW * 2)}
        onOpen={open}
      />
      <View style={[styles.sideStack, { width: rightW, gap: GUTTER }]}>
        {side.map((item, index) => (
          <Thumb
            key={item.assetId}
            item={item}
            style={{ width: rightW, height: sideH, borderRadius: RADIUS }}
            decode={Math.ceil(rightW * 2)}
            onOpen={open}
            overlay={
              index === side.length - 1 && overflow > 0
                ? `+${overflow}`
                : undefined
            }
          />
        ))}
      </View>
    </View>
  );
}

function placeLineFor(
  section: DayTimelineSection,
  labels: Record<string, string>,
): string {
  const names = section.places
    .map((block) => labels[block.placeKey])
    .filter(Boolean) as string[];
  if (names.length === 0) {
    return strings.playback.placeLoading;
  }
  return names.length === 1
    ? names[0]!
    : `${names[0]} 외 ${names.length - 1}곳`;
}

function DaySection({
  section,
  width,
  covers,
  labels,
  onOpen,
}: {
  section: DayTimelineSection;
  width: number;
  covers: Record<string, string>;
  labels: Record<string, string>;
  onOpen: (cluster: PlaceCluster | null, photos: DisplayPhoto[]) => void;
}) {
  const shell = useShellInk();
  const contentW = width - theme.spacing.lg * 2;

  const thumbs: DayThumb[] = useMemo(() => {
    const byPlace = section.places.flatMap((block) => {
      const coverId = covers[block.placeKey];
      const photos = [...block.photos];
      if (coverId) {
        const at = photos.findIndex((photo) => photo.assetId === coverId);
        if (at > 0) {
          const [cover] = photos.splice(at, 1);
          if (cover) {
            photos.unshift(cover);
          }
        }
      }
      return photos.map((photo) => ({
        assetId: photo.assetId,
        takenAt: photo.takenAt,
      }));
    });
    return [
      ...byPlace,
      ...section.noLocationPhotos.map((photo) => ({
        assetId: photo.assetId,
        takenAt: photo.takenAt,
      })),
    ].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  }, [covers, section.noLocationPhotos, section.places]);

  const placeLine = placeLineFor(section, labels);

  const openDayAsset = useCallback(
    (_assetId: string) =>
      onOpen(section.places[0]?.cluster ?? null, section.photos),
    [onOpen, section.photos, section.places],
  );

  return (
    <View style={styles.section}>
      <View style={styles.dateRow}>
        <Text style={[styles.dateLabel, shell.ink]}>{section.dateLabel}</Text>
        <Text style={[styles.placeCount, shell.subtle]}>
          {strings.months.photoCount(thumbs.length)}
        </Text>
      </View>
      {section.places.length > 0 ? (
        <Text style={[styles.placeLabel, shell.soft]} numberOfLines={1}>
          {`📍 ${placeLine}`}
        </Text>
      ) : null}
      <DayCollage
        thumbs={thumbs}
        width={contentW}
        onOpenAsset={openDayAsset}
      />
    </View>
  );
}

function PlaybackChrome({
  month,
  onOpenMonths,
  onOpenDateJump,
}: {
  month: string;
  onOpenMonths: () => void;
  onOpenDateJump: () => void;
}) {
  const shell = useShellInk();
  return (
    <View style={styles.chrome}>
      <Text style={[styles.screenTitle, shell.ink]}>{strings.playback.title}</Text>
      <View style={styles.chromeRow}>
        <Pressable
          onPress={onOpenMonths}
          accessibilityRole="button"
          accessibilityLabel={strings.months.title}
          style={({ pressed }) => [
            styles.monthButton,
            pressed && styles.chromePressed,
          ]}
        >
          <Text style={[styles.monthTitle, shell.ink]}>{monthHeading(month)}</Text>
          <Text style={[styles.monthCaret, shell.soft]}>▼</Text>
        </Pressable>
        <Pressable
          onPress={onOpenDateJump}
          accessibilityRole="button"
          accessibilityLabel={strings.playback.openDateJump}
          style={({ pressed }) => [
            styles.calendarBtn,
            pressed && styles.chromePressed,
          ]}
        >
          <CalendarIcon color={theme.colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Detail / hide still go through PhotoPreviewSheet.
 * Cover is map-only — playback taps open the full-size viewer.
 */
export function PlaybackScreen() {
  const router = useRouter();
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const { width } = useWindowDimensions();
  const jumpSheetPad = theme.spacing.lg;
  /** Compact day hit target — full-width squares made the sheet look empty. */
  const calCellW = (width - jumpSheetPad * 2) / 7;
  const calDot = Math.min(34, Math.round(calCellW * 0.72));
  const calRowH = calDot + 6;
  const params = useLocalSearchParams<{ assetId?: string | string[] }>();
  const focusAssetId = Array.isArray(params.assetId)
    ? params.assetId[0]
    : params.assetId;
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const showLoading = useHeldBusy(isPending);
  const { covers } = usePinCovers(month);
  const [selected, setSelected] = useState<{
    cluster: PlaceCluster | null;
    photos: DisplayPhoto[];
  } | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [dateJumpOpen, setDateJumpOpen] = useState(false);
  const listRef = useRef<FlatList<DayTimelineSection>>(null);
  const didFocusScroll = useRef<string | null>(null);

  const sections = useMemo(
    () => (data ? buildDayTimeline(data.displayPhotos) : []),
    [data],
  );

  const photoDays = useMemo(
    () =>
      new Set(
        sections
          .map((section) => dayOfMonth(section.dayKey))
          .filter((day): day is number => day != null),
      ),
    [sections],
  );
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
  const calendarSlots = Array.from(
    { length: firstWeekday + daysInMonth },
    (_, index) => index - firstWeekday + 1,
  );

  const openMonths = useCallback(() => {
    router.push('/months');
  }, [router]);

  useEffect(() => {
    if (!data || showLoading) {
      return;
    }
    startMonthThumbPrewarm({
      month,
      priorityIds: Object.values(covers),
      monthAssetIds: data.displayPhotos.map((p) => p.assetId),
      maxMonthFill: 64,
    });
  }, [covers, data, month, showLoading]);

  useEffect(() => {
    let cancelled = false;
    const blocks = sections.flatMap((s) => s.places);
    void (async () => {
      const next: Record<string, string> = {};
      for (const block of blocks) {
        if (cancelled) {
          return;
        }
        if (labels[block.placeKey]) {
          next[block.placeKey] = labels[block.placeKey]!;
          continue;
        }
        const label = await resolveClusterDetailLabel(
          block.centerLat,
          block.centerLng,
        );
        if (label) {
          next[block.placeKey] = label;
        }
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setLabels((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Resolve labels when sections change; intentionally skip labels dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const jumpToDay = useCallback(
    (dayKey: string) => {
      const index = sections.findIndex((section) => section.dayKey === dayKey);
      setDateJumpOpen(false);
      if (index < 0) {
        return;
      }
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
        });
      });
    },
    [sections],
  );

  useEffect(() => {
    if (!focusAssetId || sections.length === 0) {
      return;
    }
    if (didFocusScroll.current === focusAssetId) {
      return;
    }
    for (const section of sections) {
      if (section.photos.some((photo) => photo.assetId === focusAssetId)) {
        didFocusScroll.current = focusAssetId;
        setSelected({
          cluster: section.places[0]?.cluster ?? null,
          photos: section.photos,
        });
        jumpToDay(section.dayKey);
        return;
      }
    }
  }, [focusAssetId, jumpToDay, sections]);

  const onOpen = useCallback(
    (cluster: PlaceCluster | null, photos: DisplayPhoto[]) => {
      setSelected({ cluster, photos });
    },
    [],
  );

  const chrome = (
    <PlaybackChrome
      month={month}
      onOpenMonths={openMonths}
      onOpenDateJump={() => setDateJumpOpen(true)}
    />
  );

  if (showLoading) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        {chrome}
        <StateView
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
        <HomeNavBar items={APP_NAV_ITEMS} />
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        {chrome}
        <StateView title={strings.playback.empty} />
        <HomeNavBar items={APP_NAV_ITEMS} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
      {chrome}
      <FlatList
        ref={listRef}
        data={sections}
        keyExtractor={(item) => item.dayKey}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <DaySection
            section={item}
            width={width}
            covers={covers}
            labels={labels}
            onOpen={onOpen}
          />
        )}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0,
            });
          }, 120);
        }}
      />
      <HomeNavBar items={APP_NAV_ITEMS} />
      <PhotoPreviewSheet
        cluster={selected?.cluster ?? null}
        photos={selected?.photos}
        onClose={() => setSelected(null)}
      />
      <Modal
        visible={dateJumpOpen}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => setDateJumpOpen(false)}
      >
        <View style={styles.jumpBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDateJumpOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={strings.common.cancel}
          />
          <View style={styles.jumpSheet}>
            <View style={styles.jumpHandle} />
            <View style={styles.jumpHeader}>
              <Text style={[styles.jumpTitle, shell.ink]}>{monthHeading(month)}</Text>
              <Pressable onPress={() => setDateJumpOpen(false)} hitSlop={8}>
                <Text style={[styles.jumpClose, shell.soft]}>{strings.common.confirm}</Text>
              </Pressable>
            </View>
            <View style={styles.weekdayRow}>
              {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
                <Text
                  key={weekday}
                  style={[styles.weekday, { width: calCellW }, shell.subtle]}
                >
                  {weekday}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarSlots.map((day, index) => {
                const hasPhotos = photoDays.has(day);
                return day < 1 ? (
                  <View
                    key={`blank-${index}`}
                    style={[styles.calendarCell, { width: calCellW, height: calRowH }]}
                  />
                ) : (
                  <Pressable
                    key={day}
                    disabled={!hasPhotos}
                    onPress={() => {
                      const target = sections.find(
                        (section) => dayOfMonth(section.dayKey) === day,
                      );
                      if (target) {
                        jumpToDay(target.dayKey);
                      }
                    }}
                    style={[
                      styles.calendarCell,
                      { width: calCellW, height: calRowH },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !hasPhotos }}
                  >
                    <View
                      style={[
                        styles.calendarDot,
                        {
                          width: calDot,
                          height: calDot,
                          borderRadius: calDot / 2,
                        },
                        hasPhotos && styles.calendarDotOn,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDay,
                          shell.soft,
                          hasPhotos && styles.calendarDayOn,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.jumpListTitle, shell.ink]}>
              {strings.playback.datesWithPhotos}
            </Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.jumpList}
            >
              {sections.map((section) => {
                const coverId = section.photos[0]?.assetId;
                return (
                  <Pressable
                    key={section.dayKey}
                    onPress={() => jumpToDay(section.dayKey)}
                    style={({ pressed }) => [
                      styles.jumpRow,
                      pressed && styles.jumpRowPressed,
                    ]}
                  >
                    {coverId ? (
                      <AssetThumbImage
                        assetId={coverId}
                        size={JUMP_THUMB * 2}
                        style={styles.jumpThumb}
                      />
                    ) : (
                      <View style={styles.jumpThumb} />
                    )}
                    <View style={styles.jumpRowCopy}>
                      <Text style={[styles.jumpRowDate, shell.ink]}>
                        {section.dateLabel}
                      </Text>
                      <Text
                        style={[styles.jumpRowPlace, shell.soft]}
                        numberOfLines={1}
                      >
                        {section.places.length > 0
                          ? placeLineFor(section, labels)
                          : ''}
                      </Text>
                    </View>
                    <Text style={[styles.jumpRowCount, shell.soft]}>
                      {strings.months.photoCount(section.photos.length)} ›
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  chrome: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: 6,
  },
  screenTitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chromePressed: {
    opacity: 0.55,
  },
  monthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  monthTitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  monthCaret: {
    fontFamily: theme.fonts.sans,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: 36,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  dateLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  placeLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  placeCount: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  sideStack: {
    flexDirection: 'column',
  },
  thumb: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  thumbFill: {
    width: '100%',
    height: '100%',
  },
  overflow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(51,71,91,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowText: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.white,
  },
  calendarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(51,71,91,0.24)',
  },
  jumpSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  jumpHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.hairline,
    marginBottom: theme.spacing.sm,
  },
  jumpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  jumpTitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  jumpClose: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  weekday: {
    textAlign: 'center',
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.sm,
  },
  calendarCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDotOn: {
    backgroundColor: theme.colors.ink,
  },
  calendarDay: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    // Match fontSize so the glyph sits in the circle (lineHeight skews RN Text).
    lineHeight: 13,
    includeFontPadding: false,
  },
  calendarDayOn: {
    color: theme.colors.surface,
    fontWeight: '700',
  },
  jumpListTitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  jumpList: {
    paddingBottom: theme.spacing.xl,
  },
  jumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 58,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  jumpRowPressed: {
    opacity: 0.58,
  },
  jumpThumb: {
    width: JUMP_THUMB,
    height: JUMP_THUMB,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  jumpRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  jumpRowDate: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  jumpRowPlace: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  jumpRowCount: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
});
