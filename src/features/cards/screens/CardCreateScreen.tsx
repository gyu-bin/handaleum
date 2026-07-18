import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

import { useCurrentMonth } from '../../photos/hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../../photos/hooks/useMonthlyPhotos';
import { PhotoSelectGrid } from '../components/PhotoSelectGrid';
import { useSaveCard } from '../hooks/useCards';
import type { CardTemplate, MapSnapshot } from '../types';

/**
 * Photo selection + title/comment input + template choice.
 * Editing state is screen-local useState (spec A-4); persisted only on save.
 */
export function CardCreateScreen() {
  const router = useRouter();
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const saveCard = useSaveCard();

  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [template, setTemplate] = useState<CardTemplate>('feed');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedPhotos = useMemo(() => {
    if (!data) {
      return [];
    }
    const set = new Set(selectedAssetIds);
    return data.photos.filter((p) => set.has(p.assetId));
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

  const onToggle = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  };

  const onSave = async () => {
    setFormError(null);
    if (title.trim().length === 0) {
      setFormError(strings.cards.errorTitleRequired);
      return;
    }
    if (selectedPhotos.length === 0) {
      setFormError(strings.cards.errorPhotoRequired);
      return;
    }
    try {
      const card = await saveCard.mutateAsync({
        month,
        title: title.trim(),
        comment: comment.trim(),
        photoRefs: selectedPhotos,
        template,
        mapSnapshot,
      });
      router.replace(`/cards/${card.id}`);
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

  if (data.photos.length === 0) {
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScreenHeader title={strings.cards.createTitle} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.label}>{strings.cards.titlePlaceholder}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={strings.cards.titlePlaceholder}
              placeholderTextColor={theme.colors.subtle}
              maxLength={40}
              style={styles.input}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{strings.cards.commentPlaceholder}</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={strings.cards.commentPlaceholder}
              placeholderTextColor={theme.colors.subtle}
              maxLength={300}
              multiline
              style={[styles.input, styles.comment]}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{strings.cards.templateLabel}</Text>
            <View style={styles.templateRow}>
              <Pressable
                onPress={() => setTemplate('feed')}
                style={[styles.templateChip, template === 'feed' && styles.templateChipOn]}
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
              <Pressable
                onPress={() => setTemplate('story')}
                style={[styles.templateChip, template === 'story' && styles.templateChipOn]}
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

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{strings.cards.photoLabel}</Text>
              {selectedCount > 0 ? (
                <Text style={styles.selectedCount}>
                  {strings.cards.selectedCount(selectedCount)}
                </Text>
              ) : null}
            </View>
            <PhotoSelectGrid
              photos={data.photos}
              selectedAssetIds={selectedAssetIds}
              onToggle={onToggle}
            />
          </View>

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <Button
            title={strings.cards.save}
            variant="primary"
            loading={saveCard.isPending}
            onPress={() => void onSave()}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    gap: theme.spacing.sm,
  },
  label: {
    color: theme.colors.inkSoft,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedCount: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    color: theme.colors.ink,
    fontSize: 16,
  },
  comment: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 14,
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
    color: theme.colors.inkSoft,
    fontWeight: '700',
    fontSize: 14,
  },
  templateTextOn: {
    color: theme.colors.surface,
  },
  saveBtn: {
    marginTop: theme.spacing.xs,
  },
  error: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
