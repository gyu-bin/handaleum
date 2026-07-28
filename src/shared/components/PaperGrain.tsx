import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Soft paper-grain overlay for splash / loading (sample A cream paper feel).
 * Sits above a solid canvas fill; does not capture touches.
 */
export function PaperGrain({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <Image
        source={require('../../../assets/map/paper-grain.png')}
        style={styles.grain}
        resizeMode="repeat"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.22,
  },
});
