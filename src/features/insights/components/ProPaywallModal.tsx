import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/shared/components/BrandMark';
import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

export interface ProPaywallModalProps {
  visible: boolean;
  priceLabel: string;
  isBusy?: boolean;
  error?: string | null;
  onClose: () => void;
  onPurchase: () => void;
  onRestore?: () => void;
}

/**
 * Benefits sheet before the native StoreKit purchase dialog.
 * Confirm CTA → parent calls RevenueCat purchasePackage.
 */
export function ProPaywallModal({
  visible,
  priceLabel,
  isBusy = false,
  error = null,
  onClose,
  onPurchase,
  onRestore,
}: ProPaywallModalProps) {
  const insets = useSafeAreaInsets();
  const benefits = strings.settings.proPaywall.benefits;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={isBusy ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel={strings.common.cancel}
      >
        <Pressable
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.md) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />

          <View style={styles.hero}>
            <BrandMark height={52} />
            <Text style={styles.title}>{strings.settings.proPaywall.title}</Text>
            <Text style={styles.subtitle}>
              {strings.settings.proPaywall.subtitle}
            </Text>
          </View>

          <View style={styles.benefits}>
            {benefits.map((item, index) => (
              <View
                key={item.title}
                style={[
                  styles.benefitRow,
                  index < benefits.length - 1 && styles.benefitRowBorder,
                ]}
              >
                <View style={styles.benefitDot} />
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{item.title}</Text>
                  <Text style={styles.benefitBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.oneTime}>{strings.settings.proPaywall.oneTime}</Text>

          <Button
            title={strings.settings.proPaywall.cta(priceLabel)}
            variant="accent"
            size="lg"
            loading={isBusy}
            disabled={isBusy}
            onPress={onPurchase}
          />

          {onRestore ? (
            <Button
              title={strings.settings.proRestore}
              variant="ghost"
              size="md"
              loading={isBusy}
              disabled={isBusy}
              onPress={onRestore}
            />
          ) : null}

          <Pressable
            onPress={onClose}
            disabled={isBusy}
            accessibilityRole="button"
            style={styles.laterHit}
          >
            <Text style={styles.later}>{strings.settings.proPaywall.later}</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.overlayDark,
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.md,
    ...theme.shadows.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.hairline,
    marginBottom: theme.spacing.xs,
  },
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  subtitle: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  benefits: {
    marginTop: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  benefitRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  benefitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: theme.colors.accent,
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    ...theme.type.label,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  benefitBody: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
  },
  oneTime: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    textAlign: 'center',
  },
  laterHit: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  later: {
    ...theme.type.label,
    color: theme.colors.subtle,
  },
  error: {
    ...theme.type.micro,
    color: theme.colors.ink,
    textAlign: 'center',
  },
});
