import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

export interface StampPagerProps<T> {
  data: T[];
  index: number;
  onIndexChange: (index: number) => void;
  keyExtractor: (item: T) => string;
  renderPage: (item: T) => ReactNode;
  extraData?: unknown;
}

/**
 * Instagram-style paging between sibling stamp screens (sido or L1).
 */
export function StampPager<T>({
  data,
  index,
  onIndexChange,
  keyExtractor,
  renderPage,
  extraData,
}: StampPagerProps<T>) {
  const windowWidth = useWindowDimensions().width;
  const [width, setWidth] = useState(windowWidth);
  const listRef = useRef<FlatList<T>>(null);
  const skipSync = useRef(false);
  const ready = useRef(false);
  const indexRef = useRef(index);
  const widthRef = useRef(width);
  const dataLenRef = useRef(data.length);
  const renderPageRef = useRef(renderPage);
  indexRef.current = index;
  widthRef.current = width;
  dataLenRef.current = data.length;
  renderPageRef.current = renderPage;

  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      return;
    }
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    if (index < 0 || index >= data.length || width <= 0) {
      return;
    }
    listRef.current?.scrollToIndex({ index, animated: true });
  }, [data.length, index, width]);

  const settle = useCallback(
    (offsetX: number) => {
      const w = widthRef.current;
      if (w <= 0) {
        return;
      }
      const next = Math.round(offsetX / w);
      const clamped = Math.max(0, Math.min(dataLenRef.current - 1, next));
      if (clamped !== indexRef.current) {
        skipSync.current = true;
        onIndexChange(clamped);
      }
    },
    [onIndexChange],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      settle(e.nativeEvent.contentOffset.x);
    },
    [settle],
  );

  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const vx = e.nativeEvent.velocity?.x ?? 0;
      if (Math.abs(vx) < 0.15) {
        settle(e.nativeEvent.contentOffset.x);
      }
    },
    [settle],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<T> | null | undefined, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width],
  );

  const renderItem = useCallback(
    ({ item }: { item: T }) => (
      <View style={[styles.page, { width }]}>{renderPageRef.current(item)}</View>
    ),
    [width],
  );

  const neighborCount = Math.min(data.length, Math.max(3, index + 2));

  return (
    <View
      style={styles.list}
      onLayout={(e) => {
        const next = e.nativeEvent.layout.width;
        if (next > 0 && Math.abs(next - widthRef.current) > 0.5) {
          setWidth(next);
        }
      }}
    >
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={data}
          extraData={extraData ?? index}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          disableIntervalMomentum
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onScrollEndDrag}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          removeClippedSubviews={false}
          windowSize={5}
          initialNumToRender={neighborCount}
          maxToRenderPerBatch={3}
          initialScrollIndex={index > 0 ? index : undefined}
          onScrollToIndexFailed={({ index: failed }) => {
            requestAnimationFrame(() => {
              listRef.current?.scrollToIndex({ index: failed, animated: false });
            });
          }}
          overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
          style={styles.list}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  page: {
    flex: 1,
    overflow: 'visible',
  },
});
