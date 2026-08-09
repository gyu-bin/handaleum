import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { saveToLibraryAsync } from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';

import { CardTemplateStory } from '../components/CardTemplateStory';
import { useCard, useDeleteCard } from '../hooks/useCards';
import { captureCardImage, EXPORT_RENDER_WIDTH } from '../services/cardExport';

export interface CardPreviewScreenProps {
  cardId: string;
}

/** On-screen preview width for story (points). */
const PREVIEW_WIDTH = 270;
/** Max wait for off-screen collage images before capture. */
const EXPORT_READY_MS = 8000;
/** Let the native layer paint after Image onLoad before view-shot. */
const CAPTURE_SETTLE_MS = 120;

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Final card view. Story-only for now (feed format chips commented out).
 * Layout: scrollable preview + fixed footer actions so buttons never overlap
 * the tall story card.
 */
export function CardPreviewScreen({ cardId }: CardPreviewScreenProps) {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string | string[] }>();
  const fromCreate = (Array.isArray(from) ? from[0] : from) === 'create';
  const { data, isPending, isError, refetch } = useCard(cardId);
  const showLoading = useHeldBusy(isPending);
  const deleteCard = useDeleteCard();
  const captureTarget = useRef<View>(null);
  const exportReadyRef = useRef(false);
  const [exportReady, setExportReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    exportReadyRef.current = false;
    setExportReady(false);
  }, [cardId]);

  const onExportReady = useCallback(() => {
    exportReadyRef.current = true;
    setExportReady(true);
  }, []);

  const goBack = () => {
    // After 만들기, pop back to the kept create screen — avoid dismissTo/replace
    // remount (double memory with export collage still tearing down).
    if (fromCreate) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/cards/create');
      }
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/cards');
    }
  };

  const waitUntilExportReady = async (): Promise<boolean> => {
    if (exportReadyRef.current) {
      return true;
    }
    const start = Date.now();
    while (Date.now() - start < EXPORT_READY_MS) {
      if (exportReadyRef.current) {
        return true;
      }
      await waitMs(50);
    }
    return exportReadyRef.current;
  };

  const capture = async (): Promise<string | null> => {
    if (!captureTarget.current) {
      return null;
    }
    const ready = await waitUntilExportReady();
    if (!ready) {
      console.error('captureCardImage: export collage not ready in time');
      return null;
    }
    await waitMs(CAPTURE_SETTLE_MS);
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
      if (Platform.OS === 'ios') {
        await Share.share({ url: uri, message: data?.title });
        return;
      }
      // Android Share API does not attach file:// images via `url`.
      // expo-sharing is still an open product decision (cards/ARCHITECTURE.md).
      await saveToLibraryAsync(uri);
      Alert.alert(strings.cards.saved, strings.cards.shareAndroidHint);
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

  if (showLoading) {
    return <LoadingView />;
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.cards.previewTitle} onBack={goBack} />
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
        <ScreenHeader title={strings.cards.previewTitle} onBack={goBack} />
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
    paperSkin: data.paperSkin,
    commentAlign: data.commentAlign,
    mapSnapshot: data.mapSnapshot,
  };

  /*
  const formatOptions: { id: CardTemplate; label: string }[] = [
    { id: 'feed', label: strings.cards.templateFeed },
    { id: 'story', label: strings.cards.templateStory },
  ];
  */

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={strings.cards.previewTitle}
        onBack={goBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/*
        Feed / story format chips — temporarily story-only.
        <View style={styles.formatRow}>
          {formatOptions.map(...)}
        </View>
        */}

        <View style={styles.preview}>
          <CardTemplateStory card={draft} width={PREVIEW_WIDTH} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        <Button
          title={strings.cards.share}
          variant="primary"
          loading={busy}
          disabled={!exportReady && !busy}
          onPress={() => void onShare()}
        />
        <Button
          title={strings.cards.saveToAlbum}
          variant="secondary"
          disabled={busy || !exportReady}
          onPress={() => void onSaveImage()}
        />
        {/* Story: no title/comment edit (2026-07-22).
        <Button title={strings.cards.edit} ... />
        */}
        <Button
          title={strings.cards.delete}
          variant="ghost"
          onPress={onDelete}
        />
      </View>

      <View style={styles.offscreen} pointerEvents="none" aria-hidden>
        <View
          ref={captureTarget}
          collapsable={false}
          style={{ width: EXPORT_RENDER_WIDTH }}
        >
          <CardTemplateStory
            card={draft}
            width={EXPORT_RENDER_WIDTH}
            onReady={onExportReady}
          />
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
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  preview: {
    alignItems: 'center',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
    backgroundColor: theme.colors.background,
  },
  error: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.terracotta,
    fontWeight: '600',
    textAlign: 'center',
  },
  offscreen: {
    position: 'absolute',
    left: 10000,
    top: 0,
  },
});
