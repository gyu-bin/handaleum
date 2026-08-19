import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { saveToLibraryAsync } from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { AssetThumbImage } from '../../photos/components/AssetThumbImage';
import type { MonthKey, PhotoRef, VisitPlace } from '../../photos/types';
import { usePlaceAliases } from '../hooks/usePlaceAliases';
import { formatMonthDot } from '../utils/cardMeta';
import {
  applyPlaceAliases,
  recapBoardPages,
  recapDayCalendarNodes,
  chunkRows,
  snakeRailPath,
  snakeRows,
  type RecapBoardMode,
  type RecapBoardNode,
} from '../utils/recapBoard';
import { recapPlaceNodes } from '../utils/recapPlaceNodes';
import { PlaceAliasModal } from './PlaceAliasModal';

const PLACE_COLS = 4;
const DAY_COLS = 7;
const MAX_ROWS = 3;
const CIRCLE_INSET = 10;
const CELL_GAP_X = 16;
const DAY_GAP_X = 8;
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
  rowH,
  selected,
  renameable,
  onToggle,
  onRename,
}: {
  node: RecapBoardNode;
  size: number;
  rowH: number;
  selected: boolean;
  renameable: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string) => void;
}) {
  const empty = node.assetId == null;
  const inner = Math.max(12, size - CIRCLE_INSET);

  if (node.blank) {
    return <View style={{ width: size, height: rowH }} />;
  }

  return (
    <Pressable
      onPress={() => {
        if (!empty) {
          onToggle(node.id);
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
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: empty }}
      accessibilityLabel={node.label || undefined}
      accessibilityHint={
        renameable ? strings.cards.boardRenameHint : undefined
      }
    >
      <View
        style={[
          styles.circle,
          { width: inner, height: inner, borderRadius: inner / 2 },
          empty && styles.circleEmpty,
          !empty && !selected && styles.circleOff,
          !empty && selected && styles.circleOn,
        ]}
      >
        {node.assetId ? (
          <AssetThumbImage
            assetId={node.assetId}
            size={inner}
            style={{ width: inner, height: inner, borderRadius: inner / 2 }}
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
  inner,
  rowH,
  gridW,
  gapX,
  selectedIds,
  onToggle,
  onRename,
  onBindRef,
}: {
  pageNodes: RecapBoardNode[];
  mode: RecapBoardMode;
  cols: number;
  size: number;
  inner: number;
  rowH: number;
  gridW: number;
  gapX: number;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onRename: (id: string) => void;
  onBindRef: (el: View | null) => void;
}) {
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
            <Text key={label} style={[styles.weekday, { width: size }]}>
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
                rowH={rowH}
                selected={selectedIds.has(node.id)}
                renameable={mode === 'place' && canRenamePlace(node.id)}
                onToggle={onToggle}
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
  const { width } = useWindowDimensions();
  const boardRef = useRef<View>(null);
  const pageEls = useRef<(View | null)[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const { aliases, setAlias } = usePlaceAliases();
  const [mode, setMode] = useState<RecapBoardMode>('place');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
  const nodes = mode === 'day' ? dayNodes : placeNodes;

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
  const pad = theme.spacing.lg * 2;
  const pageW = width - pad;
  const size = Math.max(
    28,
    Math.floor((pageW - gapX * (cols - 1)) / cols),
  );
  const inner = Math.max(12, size - CIRCLE_INSET);
  const rowH = inner + CAPTION_GAP + CAPTION_LINE + CELL_PAD_BOTTOM;
  const pages = useMemo(
    () =>
      mode === 'day' ? [nodes] : recapBoardPages(nodes, cols, MAX_ROWS),
    [mode, nodes, cols],
  );
  const gridW = cols * size + gapX * (cols - 1);

  useEffect(() => {
    setPageIndex(0);
  }, [mode, month]);

  const onToggle = useCallback((id: string) => {
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
    const target = pageEls.current[pageIndex] ?? boardRef.current;
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
  }, [month, pageIndex, selectedCount]);

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
        <Text style={styles.emptyText}>{strings.cards.boardEmpty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Text style={styles.month}>{formatMonthDot(month)}</Text>
        <View style={styles.modes}>
          {(['place', 'day'] as const).map((value) => {
            const on = mode === value;
            return (
              <Pressable
                key={value}
                onPress={() => setMode(value)}
                style={[styles.modeChip, on && styles.modeChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.modeText, on && styles.modeTextOn]}>
                  {value === 'place'
                    ? strings.cards.boardPlace
                    : strings.cards.boardDay}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={styles.hint}>
        {mode === 'place'
          ? strings.cards.boardRenameHint
          : strings.cards.boardDayHint}
      </Text>

      <View style={styles.board}>
        {pages.length > 1 ? (
          <ScrollView
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={{ width: pageW }}
            onMomentumScrollEnd={(
              event: NativeSyntheticEvent<NativeScrollEvent>,
            ) => {
              const next = Math.round(
                event.nativeEvent.contentOffset.x / pageW,
              );
              setPageIndex(Math.max(0, Math.min(pages.length - 1, next)));
            }}
          >
            {pages.map((pageNodes, i) => (
              <View
                key={`page-${i}`}
                style={[styles.page, { width: pageW }]}
              >
                <BoardPage
                  pageNodes={pageNodes}
                  mode={mode}
                  cols={cols}
                  size={size}
                  inner={inner}
                  rowH={rowH}
                  gridW={gridW}
                  gapX={gapX}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                  onRename={onRename}
                  onBindRef={(el) => {
                    pageEls.current[i] = el;
                    if (i === 0) {
                      boardRef.current = el;
                    }
                  }}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <BoardPage
            pageNodes={pages[0] ?? []}
            mode={mode}
            cols={cols}
            size={size}
            inner={inner}
            rowH={rowH}
            gridW={gridW}
            gapX={gapX}
            selectedIds={selectedIds}
            onToggle={onToggle}
            onRename={onRename}
            onBindRef={(el) => {
              pageEls.current[0] = el;
              boardRef.current = el;
            }}
          />
        )}
        {pages.length > 1 ? (
          <View style={styles.dots} accessibilityElementsHidden>
            {pages.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[styles.dot, i === pageIndex && styles.dotOn]}
              />
            ))}
          </View>
        ) : null}
      </View>
      <PlaceAliasModal
        visible={editingId != null && editingAdmin != null}
        adminLabel={editingAdmin?.label ?? ''}
        initialLabel={editingShown?.label ?? editingAdmin?.label ?? ''}
        onClose={() => setEditingId(null)}
        onSave={(alias) => {
          if (editingId) {
            setAlias(editingId, alias);
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
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  page: {
    alignItems: 'center',
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
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: theme.spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.tint.soft,
  },
  dotOn: {
    backgroundColor: theme.colors.ink,
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
