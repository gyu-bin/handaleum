import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useCards } from '../hooks/useCards';

export function CardListScreen() {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useCards();

  if (isPending) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.heading}>{strings.cards.listTitle}</Text>
      </View>

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
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/cards/${item.id}`)}
              accessibilityRole="button"
            >
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
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}

      {data.length > 0 ? (
        <View style={styles.footer}>
          <Button
            title={strings.cards.createTitle}
            variant="primary"
            onPress={() => router.push('/cards/create')}
          />
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
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  heading: {
    ...theme.type.display,
    color: theme.colors.ink,
    fontWeight: '800',
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
    ...theme.shadows.card,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
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
