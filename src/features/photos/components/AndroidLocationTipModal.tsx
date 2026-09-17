import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

export interface AndroidLocationTipModalProps {
  visible: boolean;
  onConfirm: () => void;
}

/**
 * First map entry on Android: location tagging expands photo records into
 * map and stamp experiences; it never blocks the photo journal itself.
 */
export function AndroidLocationTipModal({
  visible,
  onConfirm,
}: AndroidLocationTipModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirm}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onConfirm}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{strings.map.androidLocationTipTitle}</Text>
          <Text style={styles.body}>{strings.map.androidLocationTipBody}</Text>
          <Button
            title={strings.map.androidLocationTipConfirm}
            variant="accent"
            surface="paper"
            onPress={onConfirm}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    fontWeight: '800',
  },
  body: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    lineHeight: 22,
  },
});
