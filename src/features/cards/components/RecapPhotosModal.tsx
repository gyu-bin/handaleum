import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import {
  resolveAssetUri,
  syncAssetDisplayUri,
} from '../../photos/services/mediaLibrary';
import type { PhotoRef } from '../../photos/types';

const VIEWER_IMAGE_SIZE = 1080;

function viewerUri(assetId: string): string | null {
  return Platform.OS === 'ios'
    ? `ph://${assetId}`
    : syncAssetDisplayUri(assetId, VIEWER_IMAGE_SIZE);
}

const PhotoPage = memo(function PhotoPage({
  assetId,
  width,
  height,
}: {
  assetId: string;
  width: number;
  height: number;
}) {
  const syncUri = viewerUri(assetId);
  const [asyncUri, setAsyncUri] = useState<string | null>(null);
  const uri = syncUri ?? asyncUri;

  useEffect(() => {
    if (syncUri) {
      return;
    }
    let cancelled = false;
    setAsyncUri(null);
    void resolveAssetUri(assetId, { imageSize: VIEWER_IMAGE_SIZE })
      .then((next) => {
        if (!cancelled) {
          setAsyncUri(next);
        }
      })
      .catch((error) => {
        console.warn('recap photo uri failed', assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, syncUri]);

  return (
    <View style={{ width, height, justifyContent: 'center' }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width, height }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={`${assetId}-recap`}
          priority="high"
          transition={0}
          allowDownscaling
        />
      ) : (
        <ActivityIndicator color={theme.colors.surface} />
      )}
    </View>
  );
});

export interface RecapPhotosModalProps {
  photos: PhotoRef[] | null;
  coverAssetId?: string | null;
  onSetCover?: (assetId: string) => void;
  onClose: () => void;
}

export function RecapPhotosModal({
  photos,
  coverAssetId,
  onSetCover,
  onClose,
}: RecapPhotosModalProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const visible = photos != null && photos.length > 0;
  const photosKey = photos?.map((p) => p.assetId).join('|') ?? '';
  const coverIndex = (() => {
    if (!photos || !coverAssetId) {
      return 0;
    }
    const at = photos.findIndex((photo) => photo.assetId === coverAssetId);
    return at >= 0 ? at : 0;
  })();
  const [pageIndex, setPageIndex] = useState(coverIndex);

  useEffect(() => {
    setPageIndex(coverIndex);
  }, [coverIndex, photosKey]);

  const current = photos?.[pageIndex] ?? photos?.[0];
  const currentIsCover = Boolean(
    current && coverAssetId && current.assetId === coverAssetId,
  );

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<PhotoRef>) => (
      <PhotoPage assetId={item.assetId} width={width} height={height} />
    ),
    [height, width],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<PhotoRef> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(1, width));
      setPageIndex(next);
      const around = photos;
      if (!around) {
        return;
      }
      for (const i of [next - 1, next, next + 1]) {
        const photo = around[i];
        if (!photo) {
          continue;
        }
        const uri = viewerUri(photo.assetId);
        if (uri) {
          void Image.prefetch(uri, 'memory-disk');
        }
      }
    },
    [photos, width],
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { width, height }]}>
        {photos ? (
          <FlatList
            key={photosKey}
            data={photos}
            keyExtractor={(item) => item.assetId}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={coverIndex}
            getItemLayout={getItemLayout}
            renderItem={renderPage}
            onMomentumScrollEnd={onMomentumEnd}
            initialNumToRender={1}
            maxToRenderPerBatch={1}
            windowSize={2}
            removeClippedSubviews={false}
          />
        ) : null}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={strings.cards.boardPhotosClose}
          style={[
            styles.close,
            { top: Math.max(insets.top, theme.spacing.sm) },
          ]}
        >
          <Text style={styles.closeText}>{strings.cards.boardPhotosClose}</Text>
        </Pressable>
        {onSetCover && current ? (
          <Pressable
            onPress={() => onSetCover(current.assetId)}
            disabled={currentIsCover}
            accessibilityRole="button"
            accessibilityLabel={
              currentIsCover
                ? strings.cards.boardCoverOn
                : strings.cards.boardSetCover
            }
            style={[
              styles.coverBtn,
              { bottom: Math.max(insets.bottom, theme.spacing.md) },
              currentIsCover && styles.coverBtnOn,
            ]}
          >
            <Text
              style={[
                styles.coverBtnText,
                currentIsCover && styles.coverBtnTextOn,
              ]}
            >
              {currentIsCover
                ? strings.cards.boardCoverOn
                : strings.cards.boardSetCover}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: theme.colors.ink,
  },
  close: {
    position: 'absolute',
    right: theme.spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.surface,
    fontWeight: '600',
  },
  coverBtn: {
    position: 'absolute',
    alignSelf: 'center',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  coverBtnOn: {
    backgroundColor: theme.colors.inkSoft,
  },
  coverBtnText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  coverBtnTextOn: {
    color: theme.colors.surface,
  },
});
