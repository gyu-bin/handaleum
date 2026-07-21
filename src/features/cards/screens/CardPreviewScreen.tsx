import { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { saveToLibraryAsync } from 'expo-media-library';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { CardTemplateFeed } from '../components/CardTemplateFeed';
import { CardTemplateStory } from '../components/CardTemplateStory';
import { useCard, useDeleteCard } from '../hooks/useCards';
import { captureCardImage, EXPORT_RENDER_WIDTH } from '../services/cardExport';
import type { CardTemplate } from '../types';

export interface CardPreviewScreenProps {
  cardId: string;
}

/** On-screen preview widths (points) — sized to sit comfortably on a phone. */
const PREVIEW_WIDTH: Record<CardTemplate, number> = {
  feed: 360,
  story: 270,
};

/**
 * Final card view. The user picks the export format (feed 4:5 / story 9:16) at
 * share time; the picked template is rendered off-screen at export resolution,
 * captured to a 1080-wide PNG, and handed to the system share sheet (Instagram
 * shows up there when installed) or saved to the camera roll. Offline-capable.
 */
export function CardPreviewScreen({ cardId }: CardPreviewScreenProps) {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useCard(cardId);
  const deleteCard = useDeleteCard();
  const captureTarget = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // null = follow the card's stored template; a value = user override.
  const [formatOverride, setFormatOverride] = useState<CardTemplate | null>(null);

  const capture = async (): Promise<string | null> => {
    if (!captureTarget.current) {
      return null;
    }
    try {
      return await captureCardImage(captureTarget);
    } catch (error) {
      console.error('captureCardImage failed', error);
      return null;
    }
  };

  const onShare = async () => {
    setActionError(null);
    setBusy(true);
    try {
      const uri = await capture();
      if (!uri) {
        setActionError(strings.common.error);
        return;
      }
      await Share.share({ url: uri, message: data?.title });
    } catch (error) {
      console.error('share failed', error);
      setActionError(strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  const onSaveImage = async () => {
    setActionError(null);
    setBusy(true);
    try {
      const uri = await capture();
      if (!uri) {
        setActionError(strings.common.error);
        return;
      }
      await saveToLibraryAsync(uri);
      Alert.alert(strings.cards.saved);
    } catch (error) {
      console.error('saveToLibraryAsync failed', error);
      setActionError(strings.common.error);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(strings.cards.delete, data?.title ?? '', [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: strings.cards.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteCard.mutateAsync(cardId);
              router.replace('/cards');
            } catch (error) {
              console.error('deleteCard failed', error);
              setActionError(strings.common.error);
            }
          })();
        },
      },
    ]);
  };

  if (isPending) {
    return <LoadingView />;
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.cards.listTitle} />
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  if (data === null || data === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.cards.listTitle} />
        <StateView icon="🔍" title={strings.cards.notFound} />
      </SafeAreaView>
    );
  }

  const draft = {
    month: data.month,
    title: data.title,
    comment: data.comment,
    photoRefs: data.photoRefs,
    template: data.template,
    mapSnapshot: data.mapSnapshot,
  };
  const format: CardTemplate = formatOverride ?? data.template;
  const formatOptions: { id: CardTemplate; label: string }[] = [
    { id: 'feed', label: strings.cards.templateFeed },
    { id: 'story', label: strings.cards.templateStory },
  ];

  const Template = format === 'story' ? CardTemplateStory : CardTemplateFeed;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={strings.cards.listTitle}
        onBack={() => router.replace('/cards')}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          style={styles.formatRow}
          accessibilityRole="radiogroup"
          accessibilityLabel={strings.cards.shareFormatLabel}
        >
          {formatOptions.map((opt) => {
            const selected = opt.id === format;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setFormatOverride(opt.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.formatChip, selected && styles.formatChipActive]}
              >
                <Text
                  style={[styles.formatText, selected && styles.formatTextActive]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.preview}>
          <Template card={draft} width={PREVIEW_WIDTH[format]} />
        </View>

        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        <View style={styles.actions}>
          <Button
            title={strings.cards.share}
            variant="primary"
            loading={busy}
            onPress={() => void onShare()}
          />
          <Button
            title={strings.cards.saveToAlbum}
            variant="secondary"
            disabled={busy}
            onPress={() => void onSaveImage()}
          />
          <Button
            title={strings.cards.delete}
            variant="ghost"
            onPress={onDelete}
            style={styles.deleteBtn}
          />
        </View>
      </ScrollView>

      {/*
       * Off-screen export copy at export resolution. Kept mounted so its photos
       * preload, and captured on demand. Positioned off-screen (not opacity 0,
       * which can blank the capture).
       */}
      <View style={styles.offscreen} pointerEvents="none" aria-hidden>
        {/* width pinned so the capture is exactly the template — no container slack */}
        <View
          ref={captureTarget}
          collapsable={false}
          style={{ width: EXPORT_RENDER_WIDTH }}
        >
          <Template card={draft} width={EXPORT_RENDER_WIDTH} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  formatRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  formatChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  formatChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  formatText: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  formatTextActive: {
    color: theme.colors.accent,
  },
  preview: {
    alignItems: 'center',
  },
  actions: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  deleteBtn: {
    marginTop: theme.spacing.xs,
  },
  error: {
    ...theme.type.label,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  offscreen: {
    position: 'absolute',
    left: 10000,
    top: 0,
  },
});
