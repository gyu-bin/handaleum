import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useCards, useDeleteCards } from '../hooks/useCards';
import type { RecapCard } from '../types';

export function CardListScreen() {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useCards();
  const deleteCards = useDeleteCards();

  const [editing, setEditing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /** Always home — never walk back into 카드 만들기 / preview leftovers. */
  const goHome = () => {
    router.replace('/');
  };

  const exitEdit = useCallback(() => {
    setEditing(false);
    setSelectedIds(new Set());
  }, []);

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

  if (isPending) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={strings.cards.listTitle}
        onBack={goHome}
        trailing={
          data.length > 0 ? (
            <Pressable
              onPress={editing ? exitEdit : enterEdit}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                editing ? strings.cards.listDone : strings.cards.listEdit
              }
            >
              <Text style={styles.headerAction}>
                {editing ? strings.cards.listDone : strings.cards.listEdit}
              </Text>
            </Pressable>
          ) : null
        }
      />

      {data.length === 0 ? (
        <View style={styles.emptyWrap}>
          <StateView
            icon="🗂️"
            title={strings.cards.listEmpty}
            actionLabel={strings.cards.createTitle}
            onAction={() => router.push('/cards/create')}
          />
        </View>
      ) : (
        <>
          {editing ? (
            <View style={styles.selectBar}>
              <Pressable
                onPress={allSelected ? deselectAll : selectAll}
                hitSlop={6}
                accessibilityRole="button"
              >
                <Text style={styles.selectBarAction}>
                  {allSelected
                    ? strings.cards.deselectAll
                    : strings.cards.selectAll}
                </Text>
              </Pressable>
              <Text style={styles.selectBarCount}>
                {selectedCount > 0
                  ? strings.cards.deleteSelected(selectedCount)
                  : ' '}
              </Text>
            </View>
          ) : null}

          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => {
              const selected = selectedIds.has(item.id);
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
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
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.meta}>
                      {item.month} ·{' '}
                      {item.template === 'story'
                        ? strings.cards.templateStory
                        : strings.cards.templateFeed}
                    </Text>
                  </View>
                  {!editing ? <Text style={styles.chevron}>›</Text> : null}
                </Pressable>
              );
            }}
          />
        </>
      )}

      {data.length > 0 ? (
        <View style={styles.footer}>
          {editing ? (
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
          ) : (
            <Button
              title={strings.cards.createTitle}
              variant="primary"
              onPress={() => router.push('/cards/create')}
            />
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerAction: {
    ...theme.type.label,
    color: theme.colors.accent,
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
    paddingBottom: theme.spacing.xl,
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
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
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
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  checkMark: {
    color: theme.colors.white,
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
  emptyWrap: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
});
