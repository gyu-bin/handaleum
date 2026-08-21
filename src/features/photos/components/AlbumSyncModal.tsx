import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

export interface AlbumSyncModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms a full re-scan of the camera roll. A paper sheet — it keeps the
 * light palette in dark mode, like the other card surfaces.
 */
export function AlbumSyncModal({
  visible,
  onCancel,
  onConfirm,
}: AlbumSyncModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {strings.settings.albumSyncModalTitle}
          </Text>
          <Text style={styles.body}>{strings.settings.albumSyncModalBody}</Text>
          <Button
            title={strings.settings.albumSyncModalConfirm}
            variant="primary"
            size="md"
            surface="paper"
            onPress={onConfirm}
          />
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.cancel}>
              {strings.settings.albumSyncModalCancel}
            </Text>
          </Pressable>
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
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  body: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
  },
  cancel: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    textAlign: 'center',
    paddingVertical: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.5,
  },
});
