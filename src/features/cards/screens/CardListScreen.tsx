import { useCallback, useEffect, useState } from 'react';
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
import { useCards, useDeleteCards } from '../hooks/useCards';
import type { RecapCard } from '../types';
import { useCurrentMonth } from '../../photos/hooks/useCurrentMonth';
import { useMonthJourney } from '../../photos/hooks/useMonthJourney';
import { useMonthLoadProgress } from '../../photos/hooks/useMonthLoadProgress';
import { useMonthlyPhotos } from '../../photos/hooks/useMonthlyPhotos';

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
  const { visitPlaces } = useMonthJourney(monthPhotos, {
    resetKey: month,
  });

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        <ScrollView contentContainerStyle={styles.boardScroll}>
          {monthQuery.isPending && monthPhotos.length === 0 ? (
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
          ) : (
            <RecapBoard
              month={month}
              photos={monthPhotos}
              visitPlaces={visitPlaces}
              initialMode={modeParam === 'day' ? 'day' : 'place'}
            />
          )}
        </ScrollView>
      )}

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
      ) : (
        <View
          style={[
            styles.fabWrap,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
          ]}
          pointerEvents="box-none"
        >
          <CreateCardFab onPress={() => router.push('/cards/create')} />
        </View>
      )}
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
});
