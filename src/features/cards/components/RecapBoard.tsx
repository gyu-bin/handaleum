import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { saveToLibraryAsync } from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { useHiddenPhotos } from '../../photos/hooks/useHiddenPhotos';
import { usePinCovers } from '../../photos/hooks/usePinCovers';
import { placeBucketKey } from '../../photos/services/placeCache';
import { AssetThumbImage } from '../../photos/components/AssetThumbImage';
import type { MonthKey, PhotoRef, VisitPlace } from '../../photos/types';
import { usePlaceAliases } from '../hooks/usePlaceAliases';
import { useRecapCovers } from '../hooks/useRecapCovers';
import { formatMonthDot } from '../utils/cardMeta';
import {
  applyPlaceAliases,
  recapDayCalendarNodes,
  resolveRecapCoverAssetId,
  chunkRows,
  placeIdentityFromVisitNodeId,
  snakeRailPath,
  snakeRows,
  type RecapBoardMode,
  type RecapBoardNode,
} from '../utils/recapBoard';
import {
  recapPlaceNodes,
  recapNodePhotos,
  pinCoverAmongPhotos,
} from '../utils/recapPlaceNodes';
import { PlaceAliasModal } from './PlaceAliasModal';
import { RecapPhotosModal } from './RecapPhotosModal';

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

export type RecapBoardShareState = {
  run: () => void;
  sharing: boolean;
  disabled: boolean;
  label: string;
};

export interface RecapBoardProps {
  month: MonthKey;
  photos: PhotoRef[];
  visitPlaces: VisitPlace[];
  onShareState?: (state: RecapBoardShareState | null) => void;
}

const NodeCell = memo(function NodeCell({
  node,
  size,
  inset,
  rowH,
  selected,
  renameable,
  onOpen,
  onRename,
}: {
  node: RecapBoardNode;
  size: number;
  inset: number;
  rowH: number;
  selected: boolean;
  renameable: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
}) {
  const { colors } = useTheme();
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
            backgroundColor: empty ? colors.background : theme.colors.surfaceAlt,
            borderColor: colors.hairline,
          },
          empty && styles.circleEmpty,
          !empty && !selected && styles.circleOff,
          !empty && selected && {
            borderWidth: 2,
            borderColor: colors.shellInk,
          },
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
      <Text
        style={[styles.caption, { color: colors.shellInkSoft }]}
        numberOfLines={1}
      >
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
  selectedIds,
  onOpen,
  onRename,
  onBindRef,
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
  selectedIds: Set<string>;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onBindRef: (el: View | null) => void;
}) {
  const { colors } = useTheme();
  const rows =
    mode === 'day' ? chunkRows(pageNodes, cols) : snakeRows(pageNodes, cols);
  const gridH = rows.length * rowH;
  const rail =
    mode === 'place'
      ? snakeRailPath(pageNodes.length, cols, size, rowH, inner / 2, gapX)
      : '';

  return (
    <View
      ref={onBindRef}
      collapsable={false}
      style={[styles.grid, { width: gridW }]}
    >
      {mode === 'day' ? (
        <View style={[styles.weekdayRow, { gap: gapX }]}>
          {strings.cards.boardWeekdays.map((label) => (
            <Text
              key={label}
              style={[styles.weekday, { width: size, color: colors.shellSubtle }]}
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
              stroke={colors.shellInkSoft}
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
                selected={selectedIds.has(node.id)}
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
  onShareState,
}: RecapBoardProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const boardRef = useRef<View>(null);
  const { aliases, setAlias } = usePlaceAliases();
  const { covers: recapCovers, setCover: setRecapCover } = useRecapCovers(month);
  const { covers: pinCovers, setCover: setPinCover } = usePinCovers(month);
  const { hide: hidePhoto } = useHiddenPhotos(month);
  const [mode, setMode] = useState<RecapBoardMode>('place');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewerNodeId, setViewerNodeId] = useState<string | null>(null);

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

  const filledIds = useMemo(
    () => nodes.filter((n) => n.assetId).map((n) => n.id),
    [nodes],
  );
  const filledKey = filledIds.join('|');

  useEffect(() => {
    setSelectedIds(new Set(filledIds));
    // Default-select every filled node when the month/mode set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filledKey is the identity
  }, [mode, month, filledKey]);

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

  const selectedCount = selectedIds.size;
  const shareLabel =
    mode === 'day'
      ? strings.cards.boardShareDays(selectedCount)
      : strings.cards.boardSharePlaces(selectedCount);

  const onShare = useCallback(async () => {
    if (selectedCount === 0) {
      return;
    }
    const target = boardRef.current;
    if (!target) {
      return;
    }
    setSharing(true);
    try {
      const uri = await captureRef(target, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (Platform.OS === 'ios') {
        await Share.share({ url: uri, message: formatMonthDot(month) });
        return;
      }
      await saveToLibraryAsync(uri);
      Alert.alert(strings.cards.saved, strings.cards.shareAndroidHint);
    } catch (error) {
      console.error('recap board share failed', error);
      Alert.alert(strings.common.error);
    } finally {
      setSharing(false);
    }
  }, [month, selectedCount]);

  useEffect(() => {
    if (photos.length === 0) {
      onShareState?.(null);
      return;
    }
    onShareState?.({
      run: () => {
        void onShare();
      },
      sharing,
      disabled: selectedCount === 0,
      label: shareLabel,
    });
  }, [
    photos.length,
    sharing,
    selectedCount,
    shareLabel,
    onShare,
    onShareState,
  ]);

  useEffect(() => {
    return () => {
      onShareState?.(null);
    };
  }, [onShareState]);

  if (photos.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.shellInkSoft }]}>
          {strings.cards.boardEmpty}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Text style={[styles.month, { color: colors.shellInk }]}>
          {formatMonthDot(month)}
        </Text>
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
      </View>
      <Text style={[styles.hint, { color: colors.shellSubtle }]}>
        {mode === 'place'
          ? strings.cards.boardRenameHint
          : strings.cards.boardDayHint}
      </Text>

      <View style={[styles.board, { backgroundColor: colors.background }]}>
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
          selectedIds={selectedIds}
          onOpen={onOpen}
          onRename={onRename}
          onBindRef={(el) => {
            boardRef.current = el;
          }}
        />
      </View>
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: 8,
  },
  month: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  modes: {
    flexDirection: 'row',
    gap: 6,
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  modeChipOn: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  modeText: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
    fontWeight: '700',
  },
  modeTextOn: {
    color: theme.colors.surface,
  },
  hint: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  board: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  grid: {
    alignSelf: 'center',
    position: 'relative',
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
  circleOff: {
    opacity: 0.38,
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
