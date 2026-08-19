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

import { AssetThumbImage } from '../../photos/components/AssetThumbImage';
import type { MonthKey, PhotoRef, VisitPlace } from '../../photos/types';
import { usePlaceAliases } from '../hooks/usePlaceAliases';
import { formatMonthDot } from '../utils/cardMeta';
import {
  applyPlaceAliases,
  recapDayNodes,
  snakeRailPath,
  snakeRows,
  type RecapBoardMode,
  type RecapBoardNode,
} from '../utils/recapBoard';
import { recapPlaceNodes } from '../utils/recapPlaceNodes';
import { PlaceAliasModal } from './PlaceAliasModal';

const PLACE_COLS = 4;
const DAY_COLS = 6;
const CIRCLE_INSET = 10;
const CAPTION_GAP = 4;
const CAPTION_LINE = 16;
const CELL_PAD_BOTTOM = 8;

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

export function RecapBoard({
  month,
  photos,
  visitPlaces,
  onShareState,
}: RecapBoardProps) {
  const { width } = useWindowDimensions();
  const boardRef = useRef<View>(null);
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
    () => recapDayNodes(month, photos),
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
  const pad = theme.spacing.lg * 2;
  const size = Math.floor((width - pad) / cols);
  const inner = Math.max(12, size - CIRCLE_INSET);
  const rowH = inner + CAPTION_GAP + CAPTION_LINE + CELL_PAD_BOTTOM;
  const gridW = cols * size;
  const gridH = Math.ceil(nodes.length / cols) * rowH;
  const rows = useMemo(() => snakeRows(nodes, cols), [nodes, cols]);
  const rail = useMemo(
    () =>
      mode === 'place'
        ? snakeRailPath(nodes.length, cols, size, rowH, inner / 2)
        : '',
    [mode, nodes.length, cols, size, rowH, inner],
  );

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
    if (selectedCount === 0 || !boardRef.current) {
      return;
    }
    setSharing(true);
    try {
      const uri = await captureRef(boardRef, {
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

      <View
        ref={boardRef}
        collapsable={false}
        style={styles.board}
      >
        <View style={[styles.grid, { width: gridW, height: gridH }]}>
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
                rowIndex % 2 === 1
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
