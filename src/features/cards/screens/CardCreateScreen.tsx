import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useCurrentMonth } from '../../photos/hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../../photos/hooks/useMonthlyPhotos';
import type { PhotoRef } from '../../photos/types';
import { CollageEditor } from '../components/CollageEditor';
import { PhotoSelectGrid } from '../components/PhotoSelectGrid';
import { useSaveCard } from '../hooks/useCards';
import {
  usePhotoPlaceSections,
  type PickerSortMode,
} from '../hooks/usePhotoPlaceSections';
import { cardCoordinate, formatMonthDot } from '../utils/cardMeta';
import type { MapSnapshot } from '../types';

/** The card holds up to five photos (cover + grid). */
const MAX_PHOTOS = 5;
/** Card preview width; inner content strips paper 6·frame 1·frame 7 pads ×2 = 26. */
const CARD_W = 200;
const CARD_INNER = CARD_W - 26;

/**
 * Owns hero height locally so FlatList header memo identity stays stable
 * while CollageEditor measures — avoids remount mid-drag.
 */
function CreateCardPreview({
  assetIds,
  photos,
  month,
  onSwap,
  onDraggingChange,
  onDeselect,
}: {
  assetIds: string[];
  photos: PhotoRef[];
  month: string;
  onSwap: (a: number, b: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDeselect: (assetId: string) => void;
}) {
  const [heroH, setHeroH] = useState<number | null>(null);
  const monthNumber = Number(month.split('-')[1]);
  const coord = cardCoordinate(photos);

  return (
    <View style={styles.previewStage}>
      <View style={[styles.regMark, styles.regTL]} />
      <View style={[styles.regMark, styles.regTR]} />
      <View style={[styles.regMark, styles.regBL]} />
      <View style={[styles.regMark, styles.regBR]} />

      <View style={styles.cardPaper}>
        <View style={styles.cardFrame}>
          <View style={styles.cardHead}>
            <Text style={styles.cardBrand}>한달음</Text>
            {coord ? <Text style={styles.cardCoord}>{coord}</Text> : null}
          </View>
          <View style={styles.cardRule} />

          <View
            style={styles.cardHero}
            onLayout={(e) => {
              const next = e.nativeEvent.layout.height;
              setHeroH((prev) =>
                prev != null && Math.abs(prev - next) < 0.5 ? prev : next,
              );
            }}
          >
            {heroH != null && heroH > 0 ? (
              <CollageEditor
                assetIds={assetIds}
                width={CARD_INNER}
                height={heroH}
                onSwap={onSwap}
                onDraggingChange={onDraggingChange}
                onPressCell={onDeselect}
              />
            ) : null}
          </View>

          <Text style={styles.cardTitle} numberOfLines={1}>
            {strings.map.monthTitle(monthNumber)}
          </Text>
          <View style={styles.cardFoot}>
            <View style={styles.cardTickRow}>
              <View style={styles.cardTick} />
              <Text style={styles.cardMonth}>{formatMonthDot(month)}</Text>
            </View>
            <Text style={styles.cardUnit}>MONTHLY RECAP</Text>
          </View>
        </View>
      </View>

      <Text style={styles.hint}>{strings.cards.arrangeHint}</Text>
    </View>
  );
}

/**
 * Photo selection + arrange. Title defaults to the month name (editable on
 * preview). Editing state is screen-local; persisted only on save.
 */
export function CardCreateScreen() {
  const router = useRouter();
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const saveCard = useSaveCard();

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [collageDragging, setCollageDragging] = useState(false);
  const [sortMode, setSortMode] = useState<PickerSortMode>('newest');

  // Newest first in the picker — monthly load is chronological (oldest→newest).
  const pickerPhotos = useMemo(() => {
    if (!data) {
      return [];
    }
    return [...data.allPhotos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  }, [data]);

  const { sections: placeSections, isLoading: placeLoading } = usePhotoPlaceSections(
    pickerPhotos,
    sortMode === 'place',
  );

  // Order-preserving: the collage renders in the drag order, not library order.
  const selectedPhotos = useMemo(() => {
    const byId = new Map(pickerPhotos.map((p) => [p.assetId, p]));
    return selectedAssetIds
      .map((id) => byId.get(id))
      .filter((p): p is PhotoRef => p != null);
  }, [pickerPhotos, selectedAssetIds]);

  const onSwap = useCallback((a: number, b: number) => {
    setSelectedAssetIds((prev) => {
      if (a < 0 || b < 0 || a >= prev.length || b >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[a], next[b]] = [next[b]!, next[a]!];
      return next;
    });
  }, []);

  const mapSnapshot: MapSnapshot = useMemo(() => {
    if (selectedPhotos.length === 0) {
      return {
        minLat: 33.1,
        maxLat: 38.6,
        minLng: 125.8,
        maxLng: 129.6,
      };
    }
    const lats = selectedPhotos.map((p) => p.lat);
    const lngs = selectedPhotos.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const padLat = Math.max(0.25, (maxLat - minLat) * 0.2);
    const padLng = Math.max(0.3, (maxLng - minLng) * 0.2);
    return {
      minLat: minLat - padLat,
      maxLat: maxLat + padLat,
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
    };
  }, [selectedPhotos]);

  // Selection is capped; picking past the cap swaps out the oldest pick.
  const onToggle = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }
      const next = [...prev, assetId];
      return next.length > MAX_PHOTOS
        ? next.slice(next.length - MAX_PHOTOS)
        : next;
    });
  };

  const onSave = async () => {
    setFormError(null);
    if (selectedPhotos.length === 0) {
      setFormError(strings.cards.errorPhotoRequired);
      return;
    }
    try {
      const monthNumber = Number(month.split('-')[1]);
      const card = await saveCard.mutateAsync({
        month,
        // Default title (e.g. "칠월의 기록") — editable on the preview screen.
        title: strings.map.monthTitle(monthNumber),
        comment: '',
        photoRefs: selectedPhotos,
        template: 'story',
        mapSnapshot,
      });
      // Keep create under preview so back returns to 카드 만들기.
      router.push({
        pathname: '/cards/[id]',
        params: { id: card.id, from: 'create' },
      });
    } catch (error) {
      console.error('saveCard failed', error);
      setFormError(strings.common.error);
    }
  };

  // Must stay above early returns — loading→ready would otherwise change hook count.
  const selectedCount = selectedAssetIds.length;

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBox}>
        {selectedCount > 0 ? (
          <View style={styles.section}>
            <Text style={styles.label}>{strings.cards.arrangeLabel}</Text>
            <CreateCardPreview
              assetIds={selectedAssetIds}
              photos={selectedPhotos}
              month={month}
              onSwap={onSwap}
              onDraggingChange={setCollageDragging}
              onDeselect={onToggle}
            />
          </View>
        ) : null}

        <View style={styles.meterBlock}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{strings.cards.photoLabel}</Text>
            <View style={styles.meterCount}>
              <Text style={styles.meterNum}>{selectedCount}</Text>
              <Text style={styles.meterDen}>/ {MAX_PHOTOS}장</Text>
            </View>
          </View>
          <View style={styles.meterTrack}>
            {Array.from({ length: MAX_PHOTOS }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.meterTick,
                  i < selectedCount && styles.meterTickOn,
                ]}
              />
            ))}
          </View>
        </View>
        <View style={styles.sortRow}>
          <Pressable
            onPress={() => setSortMode('newest')}
            accessibilityRole="button"
            accessibilityState={{ selected: sortMode === 'newest' }}
            style={[styles.sortChip, sortMode === 'newest' && styles.sortChipOn]}
          >
            <Text
              style={[
                styles.sortChipText,
                sortMode === 'newest' && styles.sortChipTextOn,
              ]}
            >
              {strings.cards.sortNewest}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSortMode('place')}
            accessibilityRole="button"
            accessibilityState={{ selected: sortMode === 'place' }}
            style={[styles.sortChip, sortMode === 'place' && styles.sortChipOn]}
          >
            <Text
              style={[
                styles.sortChipText,
                sortMode === 'place' && styles.sortChipTextOn,
              ]}
            >
              {strings.cards.sortByPlace}
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [
      month,
      onSwap,
      selectedAssetIds,
      selectedCount,
      selectedPhotos,
      sortMode,
    ],
  );

  if (isPending) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.cards.createTitle} />
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  if (data.allPhotos.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.cards.createTitle} />
        <StateView icon="🖼️" title={strings.map.emptyMonth} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={strings.cards.createTitle}
        trailing={
          <Pressable
            onPress={() => void onSave()}
            disabled={saveCard.isPending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={strings.cards.create}
            style={({ pressed }) => [
              styles.saveAction,
              (pressed || saveCard.isPending) && styles.saveActionDim,
            ]}
          >
            <Text style={styles.saveActionText}>{strings.cards.create}</Text>
          </Pressable>
        }
      />
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      {/* The grid owns the scroll (virtualized). Header is memoized so
          toggling scrollEnabled during collage drag does not remount
          CollageEditor mid-gesture. */}
      <PhotoSelectGrid
        key={sortMode}
        photos={pickerPhotos}
        sections={
          sortMode === 'place' ? (placeLoading ? [] : placeSections) : null
        }
        sectionsLoading={sortMode === 'place' && placeLoading}
        selectedAssetIds={selectedAssetIds}
        onToggle={onToggle}
        scrollEnabled={!collageDragging}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={listHeader}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  // No gap here: it would also space out the grid's photo rows. Section
  // spacing lives inside headerBox instead.
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  headerBox: {
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  saveAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.sand,
  },
  saveActionDim: {
    opacity: 0.55,
  },
  saveActionText: {
    ...theme.type.label,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  section: {
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '700',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: -theme.spacing.sm,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  sortChipOn: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  sortChipText: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  sortChipTextOn: {
    color: theme.colors.accent,
    fontWeight: '700',
  },
  hint: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
  previewStage: {
    backgroundColor: theme.colors.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: -theme.spacing.lg,
  },
  regMark: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: theme.tint.mid,
  },
  regTL: { top: 10, left: 14, borderLeftWidth: 1, borderTopWidth: 1 },
  regTR: { top: 10, right: 14, borderRightWidth: 1, borderTopWidth: 1 },
  regBL: { bottom: 10, left: 14, borderLeftWidth: 1, borderBottomWidth: 1 },
  regBR: { bottom: 10, right: 14, borderRightWidth: 1, borderBottomWidth: 1 },

  cardPaper: {
    width: CARD_W,
    aspectRatio: 1080 / 1920,
    backgroundColor: theme.colors.background,
    padding: 6,
    ...theme.shadows.card,
  },
  cardFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.tint.mid,
    padding: 7,
    gap: 3,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardBrand: {
    color: theme.colors.inkSoft,
    fontSize: 7.4,
    fontWeight: '700',
    letterSpacing: 1.85,
  },
  cardCoord: {
    color: theme.colors.subtle,
    fontSize: 5.6,
    letterSpacing: 0.4,
  },
  cardRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.tint.soft,
  },
  cardHero: { flex: 1, overflow: 'hidden' },
  cardTitle: {
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    fontSize: 12.6,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingTop: 2,
  },
  cardFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTickRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTick: {
    width: 5.2,
    height: 5.2,
    backgroundColor: theme.colors.sand,
  },
  cardMonth: {
    color: theme.colors.ink,
    fontSize: 8.2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardUnit: {
    color: theme.colors.subtle,
    fontSize: 5.9,
    letterSpacing: 1.2,
  },

  meterBlock: { gap: 10 },
  meterCount: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  meterNum: {
    ...theme.type.title,
    color: theme.colors.accent,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  meterDen: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    fontVariant: ['tabular-nums'],
  },
  meterTrack: { flexDirection: 'row', gap: 4, height: 3 },
  meterTick: { flex: 1, backgroundColor: theme.tint.soft },
  meterTickOn: { backgroundColor: theme.colors.accent },

  /** Fixed under the header (not in the scroll) so it's visible next to save. */
  error: {
    ...theme.type.label,
    color: theme.colors.accent,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
});
