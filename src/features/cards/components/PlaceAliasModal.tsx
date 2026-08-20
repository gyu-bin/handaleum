import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { PLACE_ALIAS_MAX } from '../schema';

export interface PlaceAliasModalProps {
  visible: boolean;
  adminLabel: string;
  initialLabel: string;
  onClose: () => void;
  onSave: (alias: string | null) => void;
}

export function PlaceAliasModal({
  visible,
  adminLabel,
  initialLabel,
  onClose,
  onSave,
}: PlaceAliasModalProps) {
  const [draft, setDraft] = useState(initialLabel);

  useEffect(() => {
    if (visible) {
      setDraft(initialLabel);
    }
  }, [initialLabel, visible]);

  const trimmed = draft.trim();
  const isCustom = trimmed.length > 0 && trimmed !== adminLabel.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.flex} onPress={onClose}>
          <Pressable
            style={styles.card}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.title}>{strings.cards.boardRenameTitle}</Text>
            {adminLabel ? (
              <Text style={styles.admin}>{adminLabel}</Text>
            ) : null}
            <TextInput
              value={draft}
              onChangeText={(text) => setDraft(text.slice(0, PLACE_ALIAS_MAX))}
              placeholder={adminLabel || strings.cards.boardRenamePlaceholder}
              placeholderTextColor={theme.colors.subtle}
              maxLength={PLACE_ALIAS_MAX}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => onSave(isCustom ? trimmed : null)}
              style={styles.input}
            />
            <Button
              title={strings.cards.save}
              size="md"
              surface="paper"
              onPress={() => onSave(isCustom ? trimmed : null)}
            />
            {isCustom ? (
              <Pressable
                onPress={() => onSave(null)}
                accessibilityRole="button"
                accessibilityLabel={strings.cards.boardRenameReset}
              >
                <Text style={styles.reset}>{strings.cards.boardRenameReset}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancel}>{strings.common.cancel}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
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
  admin: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
  },
  input: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  reset: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    fontWeight: '600',
  },
  cancel: {
    ...theme.type.label,
    color: theme.colors.subtle,
    textAlign: 'center',
  },
});
