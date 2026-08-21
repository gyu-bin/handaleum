import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { AssetThumbImage } from '../../photos/components/AssetThumbImage';
import { useHiddenPhotos } from '../../photos/hooks/useHiddenPhotos';
import { usePinCovers } from '../../photos/hooks/usePinCovers';
import { placeBucketKey } from '../../photos/services/placeCache';
import type { MonthKey, PhotoRef, VisitPlace } from '../../photos/types';
import {
  streakFlamePx,
  type PhotoStreak,
} from '../../photos/utils/photoStreak';
import { usePhotoStreak } from '../hooks/usePhotoStreak';
import { usePlaceAliases } from '../hooks/usePlaceAliases';
import { useRecapCovers } from '../hooks/useRecapCovers';
import { formatMonthDot } from '../utils/cardMeta';
import {
  applyPlaceAliases,
  chunkRows,
  placeIdentityFromVisitNodeId,
  recapDayCalendarNodes,
  resolveRecapCoverAssetId,
  snakeRailPath,
  snakeRows,
  type RecapBoardMode,
  type RecapBoardNode,
} from '../utils/recapBoard';
import {
  pinCoverAmongPhotos,
  recapNodePhotos,
  recapPlaceNodes,
} from '../utils/recapPlaceNodes';
import { PlaceAliasModal } from './PlaceAliasModal';
import { RecapPhotosModal } from './RecapPhotosModal';

/** Fluent Emoji Fire 3D (MIT, Microsoft). */
const STREAK_FLAME = require('../../../../assets/icons/streak-flame.png');

const PLACE_COLS = 4;
const DAY_COLS = 7;
const CIRCLE_INSET = 10;
const DAY_INSET = 4;
const CELL_GAP_X = 16;
const DAY_GAP_X = 5;
const CAPTION_GAP = 4;
const CAPTION_LINE = 16;
const CELL_PAD_BOTTOM = 14;

function canRenamePlace(id: string): boolean {
  return id.length > 0 && !id.startsWith('pending:');
}

function PhotoStreakLine({
  streak,
  ink,
  inkSoft,
}: {
  streak: PhotoStreak;
  ink: string;
  inkSoft: string;
}) {
  const flamePx = streak.kind === 'best' ? 0 : streakFlamePx(streak.current);
  const numberStyle = [styles.streakNumber, { color: ink }];
  const phraseStyle = [styles.streakPhrase, { color: inkSoft }];
  const label =
    streak.kind === 'live'
      ? strings.cards.streakLive(streak.current)
      : streak.kind === 'liveBest'
        ? strings.cards.streakLiveBest(streak.current, streak.best)
        : strings.cards.streakBest(streak.best);

  return (
    <View
      style={styles.streakRow}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      {flamePx > 0 ? (
        <View style={[styles.streakFlame, { width: flamePx, height: flamePx }]}>
          <Image
            source={STREAK_FLAME}
            style={{
              width: flamePx * 1.28,
              height: flamePx * 1.28,
              marginLeft: flamePx * -0.14,
              marginTop: flamePx * -0.14,
            }}
            resizeMode="contain"
            accessibilityElementsHidden
          />
          <Text
            style={[
              styles.streakFlameCount,
              {
                top: flamePx * 0.3,
                fontSize: Math.max(11, flamePx * 0.36),
                color: theme.colors.surface,
                textShadowColor: theme.colors.ink,
              },
            ]}
            allowFontScaling={false}
          >
            {streak.current}
          </Text>
        </View>
      ) : null}
      <Text style={styles.streakLine} numberOfLines={1}>
        {streak.kind === 'live' ? (
          flamePx > 0 ? (
            <Text style={phraseStyle}>일 연속 촬영!</Text>
          ) : (
            <>
              <Text style={numberStyle}>{streak.current}</Text>
              <Text style={phraseStyle}>일 연속 촬영!</Text>
            </>
          )
        ) : streak.kind === 'liveBest' ? (
          flamePx > 0 ? (
            <>
              <Text style={phraseStyle}>일 연속 · 최고 </Text>
              <Text style={numberStyle}>{streak.best}</Text>
              <Text style={phraseStyle}>일</Text>
            </>
          ) : (
            <>
              <Text style={numberStyle}>{streak.current}</Text>
              <Text style={phraseStyle}>일 연속 · 최고 </Text>
              <Text style={numberStyle}>{streak.best}</Text>
              <Text style={phraseStyle}>일</Text>
            </>
          )
        ) : (
          <>
            <Text style={phraseStyle}>최고 </Text>
            <Text style={numberStyle}>{streak.best}</Text>
            <Text style={phraseStyle}>일</Text>
          </>
        )}
      </Text>
    </View>
  );
}

export interface RecapBoardProps {
  month: MonthKey;
  photos: PhotoRef[];
  visitPlaces: VisitPlace[];
  initialMode?: RecapBoardMode;
}

const NodeCell = memo(function NodeCell({
  node,
  size,
  inset,
  rowH,
  renameable,
  onOpen,
  onRename,
}: {
  node: RecapBoardNode;
  size: number;
  inset: number;
  rowH: number;
  renameable: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
}) {
  const empty = node.assetId == null;
  const inner = Math.max(12, size - inset);

  if (node.blank) {
    return <View style={{ width: size, height: rowH }} />;
  }

  return (
    <Pressable
      onPress={() => {
        if (!empty) {
          onOpen(node.id);
        }
      }}
      onLongPress={() => {
        if (renameable) {
          onRename(node.id);
        }
      }}
      delayLongPress={350}
      disabled={empty}
      style={[styles.cell, { width: size, height: rowH }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: empty }}
      accessibilityLabel={node.label || undefined}
      accessibilityHint={
        renameable ? strings.cards.boardRenameHint : undefined
      }
    >
      <View
        style={[
          styles.circle,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
          },
          empty && styles.circleEmpty,
          !empty && styles.circleOn,
        ]}
      >
        {node.assetId ? (
          <AssetThumbImage
            assetId={node.assetId}
            size={inner}
            style={styles.circlePhoto}
          />
        ) : null}
      </View>
      <Text style={styles.caption} numberOfLines={1}>
        {node.label}
      </Text>
    </Pressable>
  );
});

function BoardPage({
  pageNodes,
  mode,
  cols,
  size,
  inset,
  inner,
  rowH,
  gridW,
  gapX,
  onOpen,
  onRename,
}: {
  pageNodes: RecapBoardNode[];
  mode: RecapBoardMode;
  cols: number;
  size: number;
  inset: number;
  inner: number;
  rowH: number;
  gridW: number;
  gapX: number;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
}) {
  const rows =
    mode === 'day' ? chunkRows(pageNodes, cols) : snakeRows(pageNodes, cols);
  const gridH = rows.length * rowH;
  const rail =
    mode === 'place'
      ? snakeRailPath(pageNodes.length, cols, size, rowH, inner / 2, gapX)
      : '';

  return (
    <View collapsable={false} style={[styles.grid, { width: gridW }]}>
      {mode === 'day' ? (
        <View style={[styles.weekdayRow, { gap: gapX }]}>
          {strings.cards.boardWeekdays.map((label) => (
            <Text
              key={label}
              style={[styles.weekday, { width: size }]}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={{ width: gridW, height: gridH }}>
        {rail ? (
          <Svg
            pointerEvents="none"
            width={gridW}
            height={gridH}
            style={styles.rail}
          >
            <Path
              d={rail}
              fill="none"
              stroke={theme.colors.inkSoft}
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        ) : null}
        {rows.map((row, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[
              styles.row,
              { gap: gapX },
              rowIndex % 2 === 1 && mode !== 'day'
                ? styles.rowRtl
                : styles.rowLtr,
            ]}
          >
            {row.map((node) => (
              <NodeCell
                key={node.id}
                node={node}
                size={size}
                inset={inset}
                rowH={rowH}
                renameable={mode === 'place' && canRenamePlace(node.id)}
                onOpen={onOpen}
                onRename={onRename}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

export function RecapBoard({
  month,
  photos,
  visitPlaces,
  initialMode = 'place',
}: RecapBoardProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { aliases, setAlias } = usePlaceAliases();
  const { covers: recapCovers, setCover: setRecapCover } = useRecapCovers(month);
  const { covers: pinCovers, setCover: setPinCover } = usePinCovers(month);
  const { hide: hidePhoto } = useHiddenPhotos(month);
  const streak = usePhotoStreak(month, photos);
  const [mode, setMode] = useState<RecapBoardMode>(initialMode);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewerNodeId, setViewerNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode === 'day') {
      setMode('day');
    }
  }, [initialMode]);

  const swipeMode = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-28, 28])
        .failOffsetY([-24, 24])
        .onEnd((e) => {
          if (e.translationX < -48) {
            setMode('day');
          } else if (e.translationX > 48) {
            setMode('place');
          }
        }),
    [],
  );

  const placeBase = useMemo(
    () => recapPlaceNodes(photos, visitPlaces),
    [photos, visitPlaces],
  );
  const placeNodes = useMemo(
    () => applyPlaceAliases(placeBase, aliases),
    [aliases, placeBase],
  );
  const dayNodes = useMemo(
    () => recapDayCalendarNodes(month, photos),
    [month, photos],
  );
  const rawNodes = mode === 'day' ? dayNodes : placeNodes;
  const nodes = useMemo(
    () =>
      rawNodes.map((node) => {
        if (node.blank || node.assetId == null) {
          return node;
        }
        const list = recapNodePhotos(node.id, mode, photos);
        const assetId = resolveRecapCoverAssetId(
          node.id,
          list.map((photo) => photo.assetId),
          recapCovers,
          pinCoverAmongPhotos(list, pinCovers),
        );
        return assetId && assetId !== node.assetId
          ? { ...node, assetId }
          : node;
      }),
    [mode, photos, pinCovers, rawNodes, recapCovers],
  );
  const viewerPhotos = viewerNodeId
    ? recapNodePhotos(viewerNodeId, mode, photos)
    : null;
  const viewerCover =
    viewerNodeId == null
      ? null
      : nodes.find((node) => node.id === viewerNodeId)?.assetId ?? null;

  const cols = mode === 'day' ? DAY_COLS : PLACE_COLS;
  const gapX = mode === 'day' ? DAY_GAP_X : CELL_GAP_X;
  const inset = mode === 'day' ? DAY_INSET : CIRCLE_INSET;
  const pad = theme.spacing.lg * 2;
  const pageW = width - pad;
  const size = Math.max(
    28,
    Math.floor((pageW - gapX * (cols - 1)) / cols),
  );
  const inner = Math.max(12, size - inset);
  const rowH = inner + CAPTION_GAP + CAPTION_LINE + CELL_PAD_BOTTOM;
  const gridW = cols * size + gapX * (cols - 1);

  const onOpen = useCallback((id: string) => {
    setViewerNodeId(id);
  }, []);

  const onSetViewerCover = useCallback(
    (assetId: string) => {
      if (!viewerNodeId) {
        return;
      }
      setRecapCover(viewerNodeId, assetId);
      const photo = recapNodePhotos(viewerNodeId, mode, photos).find(
        (item) => item.assetId === assetId,
      );
      if (photo) {
        setPinCover(placeBucketKey(photo.lat, photo.lng), assetId);
      }
    },
    [mode, photos, setPinCover, setRecapCover, viewerNodeId],
  );

  const onRename = useCallback((id: string) => {
    if (canRenamePlace(id)) {
      setEditingId(id);
    }
  }, []);

  const editingAdmin = placeBase.find((node) => node.id === editingId);
  const editingShown = placeNodes.find((node) => node.id === editingId);
  const showStreak = mode === 'day' && streak != null;

  const toolbar = (
    <>
      <View style={styles.toolbar}>
        <View style={styles.monthSlot}>
          <Text style={[styles.month, { color: colors.shellInk }]}>
            {formatMonthDot(month)}
          </Text>
        </View>
        <View style={styles.modes}>
          {(['place', 'day'] as const).map((value) => {
            const on = mode === value;
            return (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                style={[
                  styles.modeChip,
                  { borderColor: colors.hairline },
                  on && {
                    backgroundColor: colors.shellInk,
                    borderColor: colors.shellInk,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text
                  style={[
                    styles.modeText,
                    { color: colors.shellInkSoft },
                    on && { color: colors.canvas },
                  ]}
                >
                  {value === 'place'
                    ? strings.cards.boardPlace
                    : strings.cards.boardDay}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.monthSlotEnd}>
          {showStreak && streak ? (
            <PhotoStreakLine
              streak={streak}
              ink={colors.shellInk}
              inkSoft={colors.shellInkSoft}
            />
          ) : null}
        </View>
      </View>
      {mode === 'place' || !showStreak ? (
        <Text style={[styles.hint, { color: colors.shellSubtle }]}>
          {mode === 'place'
            ? strings.cards.boardRenameHint
            : strings.cards.boardDayHint}
        </Text>
      ) : null}
    </>
  );

  if (photos.length === 0) {
    return (
      <View style={styles.wrap}>
        {toolbar}
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.shellInkSoft }]}>
            {strings.cards.boardEmpty}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {toolbar}

      <GestureDetector gesture={swipeMode}>
        <View style={styles.board}>
          <BoardPage
            pageNodes={nodes}
            mode={mode}
            cols={cols}
            size={size}
            inset={inset}
            inner={inner}
            rowH={rowH}
            gridW={gridW}
            gapX={gapX}
            onOpen={onOpen}
            onRename={onRename}
          />
        </View>
      </GestureDetector>
      <RecapPhotosModal
        photos={viewerPhotos && viewerPhotos.length > 0 ? viewerPhotos : null}
        coverAssetId={viewerCover}
        onSetCover={onSetViewerCover}
        onHide={hidePhoto}
        onClose={() => setViewerNodeId(null)}
      />
      <PlaceAliasModal
        visible={editingId != null && editingAdmin != null}
        adminLabel={editingAdmin?.label ?? ''}
        initialLabel={editingShown?.label ?? editingAdmin?.label ?? ''}
        onClose={() => setEditingId(null)}
        onSave={(alias) => {
          if (editingId) {
            setAlias(placeIdentityFromVisitNodeId(editingId), alias);
          }
          setEditingId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: theme.spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  monthSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  monthSlotEnd: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  month: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  modes: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 8,
  },
  modeChip: {
    minWidth: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  modeText: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '700',
  },
  hint: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  streakFlame: {
    overflow: 'hidden',
  },
  streakLine: {
    fontFamily: theme.fonts.sans,
    textAlign: 'right',
  },
  streakNumber: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  streakFlameCount: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: theme.fonts.sans,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 2,
  },
  streakPhrase: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
    letterSpacing: 0.35,
  },
  board: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  grid: {
    alignSelf: 'center',
    position: 'relative',
    backgroundColor: theme.colors.background,
  },
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  row: {
    flexDirection: 'row',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekday: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    textAlign: 'center',
    fontWeight: '600',
  },
  rowLtr: {
    justifyContent: 'flex-start',
  },
  rowRtl: {
    justifyContent: 'flex-end',
  },
  cell: {
    alignItems: 'center',
  },
  circle: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  circlePhoto: {
    width: '100%',
    height: '100%',
  },
  circleEmpty: {
    backgroundColor: theme.colors.background,
  },
  circleOn: {
    borderWidth: 2,
    borderColor: theme.colors.ink,
  },
  caption: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
    marginTop: CAPTION_GAP,
    maxWidth: '100%',
    textAlign: 'center',
  },
  empty: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  emptyText: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
});
