import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Svg, { Path } from 'react-native-svg';

import { LoadProgressBanner } from '@/shared/components/LoadProgressBanner';
import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useCollapseOnScroll } from '@/shared/hooks/useCollapseOnScroll';
import { useShellBackground } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { useCurrentMonth } from '../../photos/hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../../photos/hooks/useMonthlyPhotos';
import { useMonthLoadProgress } from '../../photos/hooks/useMonthLoadProgress';
import { setGridThumbWarmPaused } from '../../photos/services/mediaLibrary';
import {
  startMonthImageWarmup,
  startMonthThumbPrewarm,
} from '../../photos/services/monthImageWarmup';
import type { PhotoRef } from '../../photos/types';
import { CollageEditor } from '../components/CollageEditor';
import { PhotoSelectGrid } from '../components/PhotoSelectGrid';
import {
  DEFAULT_PAPER_SKIN,
  PAPER_SKIN_IDS,
  resolvePaperSkin,
  type PaperSkinId,
} from '../constants/paperSkins';
import { useSaveCard } from '../hooks/useCards';
import {
  placeChipsForPhotos,
  useCardPlaceChips,
} from '../hooks/useCardPlaceChips';
import {
  usePhotoPlaceSections,
  type PickerSortMode,
} from '../hooks/usePhotoPlaceSections';
import type { CommentAlign, MapSnapshot } from '../types';
import { formatMonthDot } from '../utils/cardMeta';

/** The card holds up to five photos (cover + grid). */
const MAX_PHOTOS = 5;
/** Paper pad 6 + frame border 1 + frame pad 7, both sides. */
const CARD_CHROME = 26;
/** Skin column + gap reserved on both sides so the card stays centered. */
const SKIN_COL_W = 22;
const SKIN_GAP = 12;
const SKIN_SIDE = SKIN_COL_W + SKIN_GAP;
/** Story card aspect (matches export). */
const CARD_ASPECT = 1920 / 1080;
/** Always leave this much for the photo sheet under the card when expanded. */
const SHEET_PEEK_MIN = 280;
/** Approx. screen header under the safe-area top. */
const CREATE_HEADER_H = 52;
/** One-line caption length on the create card. */
const COMMENT_MAX = 40;
/** Hint + stage padding reserved above/below the paper. */
const PREVIEW_CHROME_H = 48;

function previewCardWidth(windowW: number, bodyH: number): number {
  // Room for sticky pad + skin column + balance — dots must stay on-screen.
  const maxByWidth = windowW - theme.spacing.md * 2 - SKIN_SIDE * 2;
  const maxPreviewH = bodyH - SHEET_PEEK_MIN;
  const maxByHeight = (maxPreviewH - PREVIEW_CHROME_H) / CARD_ASPECT;
  return Math.max(180, Math.min(maxByWidth, maxByHeight));
}

function previewExpandedMaxHeight(cardW: number): number {
  // Paper + stage pads + hint — keep chrome tight so the sheet peeks higher.
  return Math.ceil(cardW * CARD_ASPECT) + PREVIEW_CHROME_H;
}

function paperSkinLabel(id: PaperSkinId): string {
  switch (id) {
    case 'ivory':
      return strings.cards.paperSkinIvory;
    case 'fog':
      return strings.cards.paperSkinFog;
    case 'sage':
      return strings.cards.paperSkinSage;
    case 'blush':
      return strings.cards.paperSkinBlush;
    case 'ink':
      return strings.cards.paperSkinInk;
  }
}

const COMMENT_ALIGNS: CommentAlign[] = ['left', 'center', 'right'];

function commentAlignLabel(align: CommentAlign): string {
  switch (align) {
    case 'left':
      return strings.cards.commentAlignLeft;
    case 'center':
      return strings.cards.commentAlignCenter;
    case 'right':
      return strings.cards.commentAlignRight;
  }
}

function AlignGlyph({
  align,
  color,
}: {
  align: CommentAlign;
  color: string;
}) {
  // Three bars — length/position encodes left / center / right.
  const bars: { y: number; w: number; x?: number }[] =
    align === 'left'
      ? [
          { y: 5, w: 12 },
          { y: 9, w: 9 },
          { y: 13, w: 11 },
        ]
      : align === 'center'
        ? [
            { y: 5, w: 12, x: 4 },
            { y: 9, w: 8, x: 6 },
            { y: 13, w: 10, x: 5 },
          ]
        : [
            { y: 5, w: 12, x: 6 },
            { y: 9, w: 9, x: 9 },
            { y: 13, w: 11, x: 7 },
          ];
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20">
      {bars.map((b, i) => (
        <Path
          key={i}
          d={`M${b.x ?? 4} ${b.y} h${b.w}`}
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

function PlaceChipGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20">
      <Path
        d="M10 2.8c-2.5 0-4.6 2-4.6 4.4 0 3.4 4.6 9.2 4.6 9.2s4.6-5.8 4.6-9.2c0-2.4-2.1-4.4-4.6-4.4z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
      <Path
        d="M10 5.6a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Owns hero height locally so FlatList header memo identity stays stable
 * while CollageEditor measures — avoids remount mid-drag.
 *
 * Row: [skin dots | centered card | align dots]. Dots never overlay paper.
 */
function CreateCardPreview({
  assetIds,
  photos: _photos,
  month,
  paperSkin,
  onPaperSkinChange,
  commentAlign,
  onCommentAlignChange,
  comment,
  onCommentChange,
  onSwap,
  onDraggingChange,
  onDeselect,
  cardW,
  placeOverlay,
  onPlaceOverlayChange,
  placeLabelsById,
}: {
  assetIds: string[];
  photos: PhotoRef[];
  month: string;
  paperSkin: PaperSkinId;
  onPaperSkinChange: (id: PaperSkinId) => void;
  commentAlign: CommentAlign;
  onCommentAlignChange: (next: CommentAlign) => void;
  comment: string;
  onCommentChange: (next: string) => void;
  onSwap: (a: number, b: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDeselect: (assetId: string) => void;
  cardW: number;
  placeOverlay: boolean;
  onPlaceOverlayChange: (next: boolean) => void;
  placeLabelsById: Record<string, string>;
}) {
  const [heroH, setHeroH] = useState<number | null>(null);
  const { colors } = useTheme();
  const cardInner = cardW - CARD_CHROME;
  const cardH = cardW * CARD_ASPECT;
  const monthNumber = Number(month.split('-')[1]);
  const skin = resolvePaperSkin(paperSkin);

  // Remeasure collage when preview size changes (sticky maxHeight used to squash it).
  useEffect(() => {
    setHeroH(null);
  }, [cardW]);

  return (
    <View style={styles.previewStage}>
      <View style={styles.previewRow}>
        <View
          style={styles.skinCol}
          accessibilityRole="radiogroup"
          accessibilityLabel={strings.cards.paperSkinLabel}
        >
          {PAPER_SKIN_IDS.map((id) => {
            const tone = resolvePaperSkin(id);
            const selected = id === paperSkin;
            return (
              <Pressable
                key={id}
                onPress={() => onPaperSkinChange(id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={strings.cards.paperSkinA11y(
                  paperSkinLabel(id),
                )}
                hitSlop={6}
                style={[
                  styles.skinDot,
                  {
                    backgroundColor: tone.paper,
                    borderColor: colors.border,
                  },
                  selected && {
                    borderWidth: 2,
                    borderColor: colors.shellInk,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.cardSlot}>
          <View
            style={[
              styles.cardPaper,
              {
                width: cardW,
                height: cardH,
                backgroundColor: skin.paper,
                borderColor:
                  paperSkin === 'ink' ? colors.shellSubtle : colors.border,
              },
            ]}
          >
            <View style={[styles.cardFrame, { borderColor: skin.line }]}>
              <View style={styles.cardHead}>
                <Text
                  style={[styles.cardHeadTitle, { color: skin.ink }]}
                  numberOfLines={1}
                >
                  {strings.map.monthTitle(monthNumber)}
                </Text>
                <Text style={[styles.cardBrand, { color: skin.inkSoft }]}>
                  한달음
                </Text>
              </View>
              <View style={[styles.cardRule, { backgroundColor: skin.line }]} />

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
                    width={cardInner}
                    height={heroH}
                    onSwap={onSwap}
                    onDraggingChange={onDraggingChange}
                    onPressCell={onDeselect}
                    placeLabelsById={placeOverlay ? placeLabelsById : undefined}
                  />
                ) : null}
              </View>

              <View style={styles.commentStrip}>
                <TextInput
                  value={comment}
                  onChangeText={(t) => onCommentChange(t.slice(0, COMMENT_MAX))}
                  placeholder={strings.cards.commentPlaceholder}
                  placeholderTextColor={skin.subtle}
                  maxLength={COMMENT_MAX}
                  numberOfLines={1}
                  style={[
                    styles.commentInput,
                    { color: skin.inkSoft, textAlign: commentAlign },
                  ]}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.cardFoot}>
                <View style={styles.cardTickRow}>
                  <View
                    style={[styles.cardTick, { backgroundColor: skin.inkSoft }]}
                  />
                  <Text style={[styles.cardMonth, { color: skin.ink }]}>
                    {formatMonthDot(month)}
                  </Text>
                </View>
                <Text style={[styles.cardUnit, { color: skin.subtle }]}>
                  MONTHLY RECAP
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={styles.alignCol}
          accessibilityRole="radiogroup"
          accessibilityLabel={strings.cards.commentAlignLabel}
        >
          {COMMENT_ALIGNS.map((align) => {
            const selected = align === commentAlign;
            return (
              <Pressable
                key={align}
                onPress={() => onCommentAlignChange(align)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={strings.cards.commentAlignA11y(
                  commentAlignLabel(align),
                )}
                hitSlop={6}
                style={[
                  styles.alignDot,
                  {
                    backgroundColor: colors.shellChip,
                    borderColor: colors.border,
                  },
                  selected && {
                    borderWidth: 2,
                    borderColor: colors.shellInk,
                  },
                ]}
              >
                <AlignGlyph
                  align={align}
                  color={selected ? colors.shellInk : colors.shellInkSoft}
                />
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => onPlaceOverlayChange(!placeOverlay)}
            hitSlop={6}
            accessibilityRole="switch"
            accessibilityState={{ checked: placeOverlay }}
            accessibilityLabel={strings.cards.placeOverlayA11y}
            style={[
              styles.alignDot,
              {
                backgroundColor: colors.shellChip,
                borderColor: colors.border,
              },
              placeOverlay && {
                borderWidth: 2,
                borderColor: colors.shellInk,
              },
            ]}
          >
            <PlaceChipGlyph
              color={placeOverlay ? colors.shellInk : colors.shellInkSoft}
            />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.hint, { color: colors.shellSubtle }]}>
        {strings.cards.arrangeHint}
      </Text>
    </View>
  );
}

/**
 * Photo selection + arrange. Title defaults to the month name (editable on
 * preview). Editing state is screen-local; persisted only on save.
 */
export function CardCreateScreen() {
  const router = useRouter();
  const shellBg = useShellBackground();
  const { colors } = useTheme();
  const { month } = useCurrentMonth();
  const { data, isPending, isFetching, isError, isStaleMonth, refetch } =
    useMonthlyPhotos(month);
  const saveCard = useSaveCard();
  const loadProgress = useMonthLoadProgress();
  const showFullLoad = (isPending && !data) || isStaleMonth;

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [selectionUndoStack, setSelectionUndoStack] = useState<string[][]>([]);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [paperSkin, setPaperSkin] = useState<PaperSkinId>(DEFAULT_PAPER_SKIN);
  const [commentAlign, setCommentAlign] = useState<CommentAlign>('left');
  const [comment, setComment] = useState('');
  const [placeOverlay, setPlaceOverlay] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [collageDragging, setCollageDragging] = useState(false);
  // Unmount the live collage while preview sits on top — keep the pick so back
  // can re-edit. Clearing ids made back look like a reset.
  const [collageSuspended, setCollageSuspended] = useState(false);
  const [sortMode, setSortMode] = useState<PickerSortMode>('newest');
  const selectedIdsRef = useRef(selectedAssetIds);
  selectedIdsRef.current = selectedAssetIds;
  const coveringPreviewRef = useRef(false);
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  // Body height under the screen header — size the card so the sheet always peeks.
  const bodyH = windowH - insets.top - CREATE_HEADER_H;
  const cardW = previewCardWidth(windowW, bodyH);
  const previewMaxH = previewExpandedMaxHeight(cardW);
  const {
    onScroll,
    collapseStyle,
    mediaScaleStyle,
    previewPan,
    setExpandedHeight,
    resetScroll,
  } = useCollapseOnScroll({
    range: 320,
    minRatio: 0,
    deadzone: 48,
    latch: true,
  });

  useLayoutEffect(() => {
    setExpandedHeight(previewMaxH);
  }, [previewMaxH, setExpandedHeight]);

  useEffect(() => {
    resetScroll();
  }, [month, resetScroll]);

  useEffect(() => {
    if (selectedAssetIds.length === 0) {
      resetScroll();
    }
  }, [selectedAssetIds.length, resetScroll]);

  // Only pause warm while this screen is covered (preview on top). Do NOT leave
  // paused=true when switching tabs — that stuck Android grids / stamp warm.
  useFocusEffect(
    useCallback(() => {
      setGridThumbWarmPaused(false);
      coveringPreviewRef.current = false;
      // Wait until preview finishes tearing down before remounting the collage.
      const task = InteractionManager.runAfterInteractions(() => {
        if (coveringPreviewRef.current) {
          return;
        }
        setCollageSuspended(false);
      });
      return () => task.cancel();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!data || showFullLoad) {
        return;
      }
      startMonthThumbPrewarm({
        month,
        priorityIds: [],
        monthAssetIds: data.allPhotos.map((p) => p.assetId),
        maxMonthFill: 48,
      });
    }, [data, month, showFullLoad]),
  );

  useEffect(() => {
    if (selectedAssetIds.length === 0) {
      return;
    }
    startMonthImageWarmup({ month, assetIds: selectedAssetIds });
  }, [month, selectedAssetIds]);

  // Newest / oldest for the flat picker; place mode still uses journey sections.
  const pickerPhotos = useMemo(() => {
    if (!data) {
      return [];
    }
    const next = [...data.allPhotos];
    if (sortMode === 'oldest') {
      next.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    } else {
      next.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
    }
    return next;
  }, [data, sortMode]);

  const {
    sections: placeSections,
    isLoading: placeLoading,
    progress: placeProgress,
  } = usePhotoPlaceSections(
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

  const placeLabelsById = useCardPlaceChips(selectedPhotos);

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

  useEffect(() => {
    if (!selectionHint) {
      return;
    }
    const timer = setTimeout(() => setSelectionHint(null), 2200);
    return () => clearTimeout(timer);
  }, [selectionHint]);

  const commitSelection = useCallback((next: string[]) => {
    const prev = selectedIdsRef.current;
    if (
      next.length === prev.length &&
      next.every((id, i) => id === prev[i])
    ) {
      return;
    }
    setSelectionUndoStack((stack) => [...stack.slice(-19), prev]);
    setSelectedAssetIds(next);
    setSelectionHint(null);
  }, []);

  // Cap at MAX — further picks are blocked (no silent swap).
  const onToggle = useCallback(
    (assetId: string) => {
      const prev = selectedIdsRef.current;
      if (prev.includes(assetId)) {
        commitSelection(prev.filter((id) => id !== assetId));
        return;
      }
      if (prev.length >= MAX_PHOTOS) {
        setSelectionHint(strings.cards.maxPhotosHint);
        return;
      }
      commitSelection([...prev, assetId]);
    },
    [commitSelection],
  );

  const onSelectionUndo = useCallback(() => {
    setSelectionUndoStack((stack) => {
      if (stack.length === 0) {
        return stack;
      }
      const previous = stack[stack.length - 1]!;
      setSelectedAssetIds(previous);
      setSelectionHint(null);
      return stack.slice(0, -1);
    });
  }, []);

  const onSelectionReset = useCallback(() => {
    const prev = selectedIdsRef.current;
    if (prev.length === 0) {
      return;
    }
    commitSelection([]);
  }, [commitSelection]);

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
        comment: comment.trim(),
        photoRefs: selectedPhotos,
        template: 'story',
        paperSkin,
        commentAlign,
        placeOverlay,
        placeLabels: placeOverlay
          ? await placeChipsForPhotos(selectedPhotos)
          : undefined,
        mapSnapshot,
      });
      setCollageDragging(false);
      setSelectionHint(null);
      // Create stays mounted under preview (freezeOnBlur). Drop the live
      // collage only — selection/comment stay so back can re-pick.
      coveringPreviewRef.current = true;
      setCollageSuspended(true);
      setGridThumbWarmPaused(true);
      // Keep create under preview so back returns to 카드 만들기.
      // Next frame: let the collage unmount commit before freezeOnBlur snapshots.
      requestAnimationFrame(() => {
        router.push({
          pathname: '/cards/[id]',
          params: { id: card.id, from: 'create' },
        });
      });
    } catch (error) {
      console.error('saveCard failed', error);
      setFormError(strings.common.error);
    }
  };

  // Must stay above early returns — loading→ready would otherwise change hook count.
  const selectedCount = selectedAssetIds.length;
  const canUndo = selectionUndoStack.length > 0;
  const canReset = selectedCount > 0;

  // Sticky sheet chrome (count + sort) — stays put while photos scroll under it.
  const sheetChrome = useMemo(
    () => (
      <View
        style={[
          styles.sheetChrome,
          shellBg,
          { borderBottomColor: colors.hairline },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.line }]} />
        <View style={styles.headerBox}>
          <View style={styles.meterBlock}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.shellInkSoft }]}>
                {strings.cards.photoLabel}
              </Text>
              <View style={styles.meterCount}>
                <Text style={[styles.meterNum, { color: colors.shellInk }]}>
                  {selectedCount}
                </Text>
                <Text style={[styles.meterDen, { color: colors.shellSubtle }]}>
                  / {MAX_PHOTOS}장
                </Text>
              </View>
            </View>
            <View style={styles.meterTrack}>
              {Array.from({ length: MAX_PHOTOS }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.meterTick,
                    { backgroundColor: colors.line },
                    i < selectedCount && { backgroundColor: colors.shellInk },
                  ]}
                />
              ))}
            </View>
            <View style={styles.selectionActions}>
              <Pressable
                onPress={onSelectionUndo}
                disabled={!canUndo}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.cards.selectionUndo}
                style={({ pressed }) => [
                  styles.selectionAction,
                  (!canUndo || pressed) && styles.selectionActionDim,
                ]}
              >
                <Text
                  style={[
                    styles.selectionActionText,
                    { color: colors.shellInkSoft },
                  ]}
                >
                  {strings.cards.selectionUndo}
                </Text>
              </Pressable>
              <Pressable
                onPress={onSelectionReset}
                disabled={!canReset}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.cards.selectionReset}
                style={({ pressed }) => [
                  styles.selectionAction,
                  (!canReset || pressed) && styles.selectionActionDim,
                ]}
              >
                <Text
                  style={[
                    styles.selectionActionText,
                    { color: colors.shellInkSoft },
                  ]}
                >
                  {strings.cards.selectionReset}
                </Text>
              </Pressable>
            </View>
            {selectionHint ? (
              <Text style={[styles.selectionHint, { color: colors.shellInk }]}>
                {selectionHint}
              </Text>
            ) : null}
          </View>
          <View style={styles.sortRow}>
            <Pressable
              onPress={() => setSortMode('newest')}
              accessibilityRole="button"
              accessibilityState={{ selected: sortMode === 'newest' }}
              style={[
                styles.sortChip,
                {
                  backgroundColor: colors.shellChip,
                  borderColor: colors.hairline,
                },
                sortMode === 'newest' && {
                  backgroundColor: colors.shellInk,
                  borderColor: colors.shellInk,
                },
              ]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  { color: colors.shellInkSoft },
                  sortMode === 'newest' && {
                    color: colors.canvas,
                    fontWeight: '700',
                  },
                ]}
              >
                {strings.cards.sortNewest}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortMode('oldest')}
              accessibilityRole="button"
              accessibilityState={{ selected: sortMode === 'oldest' }}
              style={[
                styles.sortChip,
                {
                  backgroundColor: colors.shellChip,
                  borderColor: colors.hairline,
                },
                sortMode === 'oldest' && {
                  backgroundColor: colors.shellInk,
                  borderColor: colors.shellInk,
                },
              ]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  { color: colors.shellInkSoft },
                  sortMode === 'oldest' && {
                    color: colors.canvas,
                    fontWeight: '700',
                  },
                ]}
              >
                {strings.cards.sortOldest}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSortMode('place')}
              accessibilityRole="button"
              accessibilityState={{ selected: sortMode === 'place' }}
              style={[
                styles.sortChip,
                {
                  backgroundColor: colors.shellChip,
                  borderColor: colors.hairline,
                },
                sortMode === 'place' && {
                  backgroundColor: colors.shellInk,
                  borderColor: colors.shellInk,
                },
              ]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  { color: colors.shellInkSoft },
                  sortMode === 'place' && {
                    color: colors.canvas,
                    fontWeight: '700',
                  },
                ]}
              >
                {strings.cards.sortByPlace}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    ),
    [
      selectedCount,
      sortMode,
      canUndo,
      canReset,
      selectionHint,
      onSelectionUndo,
      onSelectionReset,
      shellBg,
      colors.hairline,
      colors.line,
      colors.shellChip,
      colors.shellInk,
      colors.shellInkSoft,
      colors.shellSubtle,
      colors.canvas,
    ],
  );

  if (showFullLoad) {
    const listing =
      loadProgress.phase === 'listing' ||
      loadProgress.total <= 0 ||
      loadProgress.month !== month;
    return (
      <LoadingView
        message={
          listing
            ? strings.cards.loadingAlbum
            : strings.cards.loadingPhotos(loadProgress.done, loadProgress.total)
        }
        progress={{
          done: listing ? 0 : loadProgress.done,
          total: listing ? 0 : loadProgress.total,
        }}
      />
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
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
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.cards.createTitle} />
        <StateView icon="🖼️" title={strings.map.emptyMonth} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
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
              { backgroundColor: colors.shellInk },
              (pressed || saveCard.isPending) && styles.saveActionDim,
            ]}
          >
            <Text style={[styles.saveActionText, { color: colors.canvas }]}>
              {strings.cards.create}
            </Text>
          </Pressable>
        }
      />
      {formError ? (
        <Text style={[styles.error, { color: colors.shellInk }]}>{formError}</Text>
      ) : null}
      <View style={styles.body}>
        {/* Preview height shrinks in normal flow — do not translate the sheet (clips bottom). */}
        {selectedCount > 0 && !collageSuspended ? (
          <Animated.View
            style={[
              styles.stickyPreview,
              shellBg,
              collapseStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.previewScaleInner,
                { height: previewMaxH },
                mediaScaleStyle,
              ]}
            >
              <CreateCardPreview
                assetIds={selectedAssetIds}
                photos={selectedPhotos}
                month={month}
                paperSkin={paperSkin}
                onPaperSkinChange={setPaperSkin}
                commentAlign={commentAlign}
                onCommentAlignChange={setCommentAlign}
                comment={comment}
                onCommentChange={setComment}
                onSwap={onSwap}
                onDraggingChange={setCollageDragging}
                onDeselect={onToggle}
                cardW={cardW}
                placeOverlay={placeOverlay}
                onPlaceOverlayChange={setPlaceOverlay}
                placeLabelsById={placeLabelsById}
              />
            </Animated.View>
          </Animated.View>
        ) : null}
        <View
          style={[
            styles.gridSheet,
            shellBg,
            { borderTopColor: colors.hairline },
          ]}
        >
          {selectedCount > 0 && !collageSuspended ? (
            <GestureDetector gesture={previewPan}>{sheetChrome}</GestureDetector>
          ) : (
            sheetChrome
          )}
          {isFetching ? (
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
          ) : null}
          <View style={styles.gridFlex}>
            <PhotoSelectGrid
              photos={pickerPhotos}
              sections={
                sortMode !== 'place'
                  ? null
                  : placeSections.length > 0
                    ? placeSections
                    : null
              }
              sectionsLoading={sortMode === 'place' && placeLoading}
              sectionsProgress={placeProgress}
              selectedAssetIds={selectedAssetIds}
              onToggle={onToggle}
              scrollEnabled={!collageDragging}
              contentContainerStyle={styles.scroll}
              onScroll={onScroll}
              scrollEventThrottle={16}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  stickyPreview: {
    paddingHorizontal: theme.spacing.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  previewScaleInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  body: {
    flex: 1,
  },
  gridSheet: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetChrome: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.sm,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  gridFlex: {
    flex: 1,
  },
  // No gap here: it would also space out the grid's photo rows. Section
  // spacing lives inside headerBox instead.
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
  },
  headerBox: {
    gap: theme.spacing.md,
  },
  saveAction: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  saveActionDim: {
    opacity: 0.55,
  },
  saveActionText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
  },
  section: {
    gap: theme.spacing.sm,
  },
  label: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
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
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  sortChipText: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
  },
  hint: {
    ...theme.type.micro,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  previewStage: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  /** In-flow column — cannot paint over the card. */
  skinCol: {
    width: SKIN_COL_W,
    marginRight: SKIN_GAP,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    zIndex: 2,
  },
  /** Right column — comment align; same width as skinCol so card stays centered. */
  alignCol: {
    width: SKIN_COL_W,
    marginLeft: SKIN_GAP,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    zIndex: 2,
  },
  cardSlot: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  skinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  alignDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardPaper: {
    padding: 6,
    borderWidth: 1,
    ...theme.shadows.card,
  },
  cardFrame: {
    flex: 1,
    borderWidth: 1,
    padding: 7,
    gap: 3,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardHeadTitle: {
    flex: 1,
    flexShrink: 1,
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'left',
  },
  cardBrand: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.85,
    textAlign: 'right',
  },
  cardRule: {
    height: StyleSheet.hairlineWidth,
  },
  cardHero: {
    flex: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  commentStrip: {
    paddingHorizontal: 2,
    paddingVertical: 6,
    minHeight: 30,
    justifyContent: 'center',
    marginBottom: 4,
  },
  commentInput: {
    fontSize: 9.5,
    lineHeight: 13,
    padding: 0,
    margin: 0,
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
  },
  cardMonth: {
    fontSize: 8.2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardUnit: {
    fontSize: 5.9,
    letterSpacing: 1.2,
  },

  meterBlock: { gap: 10 },
  meterCount: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  meterNum: {
    ...theme.type.title,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  meterDen: {
    ...theme.type.micro,
    fontVariant: ['tabular-nums'],
  },
  meterTrack: { flexDirection: 'row', gap: 4, height: 3 },
  meterTick: { flex: 1 },
  selectionActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: 2,
  },
  selectionAction: {
    paddingVertical: 4,
  },
  selectionActionDim: {
    opacity: 0.35,
  },
  selectionActionText: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
  },
  selectionHint: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
  },

  /** Fixed under the header (not in the scroll) so it's visible next to save. */
  error: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
});
