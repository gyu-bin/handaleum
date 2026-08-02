import { StyleSheet, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

/** Hand-drawn feel dashed rule under the year stepper. */
export function JournalDottedRule() {
  return (
    <View style={styles.ruleRow} accessibilityElementsHidden>
      {Array.from({ length: 28 }, (_, i) => (
        <View key={i} style={styles.ruleDot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  ruleDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.tint.soft,
  },
});
