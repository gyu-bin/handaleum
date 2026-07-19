import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { VisitAdminLevel } from '../types';
import { VisitChipRow } from './VisitChipRow';

export interface VisitScopeBarProps {
  level: VisitAdminLevel;
  labels: string[];
  isResolving?: boolean;
}

/**
 * Bottom strip of this month's places, grain follows map zoom (도 → 시 → 동).
 */
export function VisitScopeBar({
  level,
  labels,
  isResolving = false,
}: VisitScopeBarProps) {
  if (isResolving && labels.length === 0) {
    return (
      <View style={styles.bar}>
        <Text style={styles.level}>{strings.map.visitScope[level]}</Text>
        <Text style={styles.empty}>{strings.common.loading}</Text>
      </View>
    );
  }

  if (labels.length === 0) {
    return null;
  }

  return (
    <View style={styles.bar} accessibilityRole="summary">
      <Text style={styles.level}>{strings.map.visitScope[level]}</Text>
      <VisitChipRow labels={labels} tone="quiet" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: 4,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  level: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: theme.colors.subtle,
  },
  empty: {
    fontSize: 13,
    color: theme.colors.inkSoft,
  },
});
