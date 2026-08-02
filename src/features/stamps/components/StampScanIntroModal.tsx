import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

export interface StampScanIntroModalProps {
  visible: boolean;
  onConfirm: () => void;
}

/**
 * First entry to 발도장: explain full-album scan may take a while;
 * sync keeps running in the background after dismiss.
 */
export function StampScanIntroModal({
  visible,
  onConfirm,
}: StampScanIntroModalProps) {
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
          <Text style={styles.title}>{strings.stamps.scanIntroTitle}</Text>
          <Text style={styles.body}>{strings.stamps.scanIntroBody}</Text>
          <Button
            title={strings.stamps.scanIntroConfirm}
            variant="accent"
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
    fontFamily: theme.fonts.serif,
    color: theme.colors.inkSoft,
    lineHeight: 22,
  },
});

