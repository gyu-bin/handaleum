import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useCurrentMonth } from '../../photos/hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../../photos/hooks/useMonthlyPhotos';
import { PhotoSelectGrid } from '../components/PhotoSelectGrid';
import { useSaveCard } from '../hooks/useCards';
import type { CardTemplate, MapSnapshot } from '../types';

/** How many photos each template can actually place on the card. */
const TEMPLATE_MAX: Record<CardTemplate, number> = { feed: 3, story: 1 };

/**
 * Photo selection + template choice. Title/comment inputs were removed
 * (2026-07-22): the title defaults to the month name and both stay editable on
 * the preview screen, so creation is just "pick photos, pick a format".
 * Editing state is screen-local useState (spec A-4); persisted only on save.
 */
export function CardCreateScreen() {
  const router = useRouter();
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const saveCard = useSaveCard();

  const [template, setTemplate] = useState<CardTemplate>('story');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const maxPhotos = TEMPLATE_MAX[template];

  const selectedPhotos = useMemo(() => {
    if (!data) {
      return [];
    }
    const set = new Set(selectedAssetIds);
    return data.allPhotos.filter((p) => set.has(p.assetId));
  }, [data, selectedAssetIds]);

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

  // Selection is capped at what the template can show; picking past the cap
  // swaps out the oldest pick (so on story, tapping a photo replaces the hero).
  const onToggle = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }
      const next = [...prev, assetId];
      return next.length > maxPhotos ? next.slice(next.length - maxPhotos) : next;
    });
  };

  // Switching to a smaller template keeps the earliest picks.
  const onSelectTemplate = (next: CardTemplate) => {
    setTemplate(next);
    setSelectedAssetIds((prev) => prev.slice(0, TEMPLATE_MAX[next]));
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

  const selectedCount = selectedAssetIds.length;

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
      {/* The grid owns the scroll (virtualized); the template picker rides
          along as its header — nesting the FlatList in a ScrollView breaks
          windowing and warns. Save lives in the screen header. */}
      <PhotoSelectGrid
        photos={data.allPhotos}
        selectedAssetIds={selectedAssetIds}
        onToggle={onToggle}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <View style={styles.headerBox}>
            <View style={styles.section}>
              <Text style={styles.label}>{strings.cards.templateLabel}</Text>
              <View style={styles.templateRow}>
                {/* Feed temporarily hidden — story only (2026-07-22).
                <Pressable
                  onPress={() => onSelectTemplate('feed')}
                  style={[
                    styles.templateChip,
                    template === 'feed' && styles.templateChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.templateText,
                      template === 'feed' && styles.templateTextOn,
                    ]}
                  >
                    {strings.cards.templateFeed}
                  </Text>
                </Pressable>
                */}
                <Pressable
                  onPress={() => onSelectTemplate('story')}
                  style={[
                    styles.templateChip,
                    template === 'story' && styles.templateChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.templateText,
                      template === 'story' && styles.templateTextOn,
                    ]}
                  >
                    {strings.cards.templateStory}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.label}>{strings.cards.photoLabel}</Text>
              <Text style={styles.selectedCount}>
                {strings.cards.selectedCount(selectedCount, maxPhotos)}
              </Text>
            </View>
          </View>
        }
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent,
  },
  saveActionDim: {
    opacity: 0.55,
  },
  saveActionText: {
    ...theme.type.label,
    color: theme.colors.white,
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
  selectedCount: {
    ...theme.type.label,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  templateRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  templateChip: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  templateChipOn: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  templateText: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '700',
  },
  templateTextOn: {
    color: theme.colors.surface,
  },
  /** Fixed under the header (not in the scroll) so it's visible next to save. */
  error: {
    ...theme.type.label,
    color: theme.colors.accent,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
});
