import { useRef, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { saveToLibraryAsync } from 'expo-media-library';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { CardTemplateFeed } from '../components/CardTemplateFeed';
import { CardTemplateStory } from '../components/CardTemplateStory';
import { useCard, useDeleteCard } from '../hooks/useCards';

export interface CardPreviewScreenProps {
  cardId: string;
}

/**
 * Final card view: capture via react-native-view-shot, save to camera roll,
 * open share sheet. Must work offline (map tiles excepted).
 */
export function CardPreviewScreen({ cardId }: CardPreviewScreenProps) {
  const router = useRouter();
  const { data, isPending, isError, refetch } = useCard(cardId);
  const deleteCard = useDeleteCard();
  const captureTarget = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const capture = async (): Promise<string | null> => {
    if (!captureTarget.current) {
      return null;
    }
    try {
      return await captureRef(captureTarget, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
    } catch (error) {
      console.error('captureRef failed', error);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={strings.cards.listTitle}
        onBack={() => router.replace('/cards')}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View ref={captureTarget} collapsable={false} style={styles.capture}>
          {data.template === 'story' ? (
            <CardTemplateStory card={draft} />
          ) : (
            <CardTemplateFeed card={draft} />
          )}
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
  capture: {
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
    color: theme.colors.accent,
    fontWeight: '600',
  },
});
