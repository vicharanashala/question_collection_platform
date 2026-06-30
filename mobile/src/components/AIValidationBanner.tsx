/**
 * AIValidationBanner.tsx
 *
 * Inline warning banner that appears below the text input area in
 * QuestionScreen when the on-device AI pipeline returns `verdict: 'warn'`.
 * Shows a localised message derived from `result.reasonKey`.
 *
 * Does NOT render when:
 *   - result.ran === false  (device unsupported)
 *   - result.verdict === 'pass'
 *   - result.verdict === 'fail'  (full-screen error is shown by QuestionScreen)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AIValidationResult } from '../utils/onDeviceAI';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

interface AIValidationBannerProps {
  result: AIValidationResult;
  /** Called when user taps "Dismiss" */
  onDismiss?: () => void;
}

type BannerVariant = 'warning' | 'error' | 'info';

function resolveVariant(verdict: AIValidationResult['verdict']): BannerVariant {
  if (verdict === 'fail') return 'error';
  if (verdict === 'warn') return 'warning';
  return 'info';
}

function resolveIcon(variant: BannerVariant): keyof typeof Ionicons.glyphMap {
  if (variant === 'error') return 'alert-circle';
  if (variant === 'warning') return 'warning';
  return 'information-circle';
}

/** Maps reasonKey suffixes to i18n key roots (shared across all locales) */
function resolveMessageKey(reasonKey: string | null): string {
  if (!reasonKey) return 'onDeviceAI.defaultMessage';
  return reasonKey;
}

export function AIValidationBanner({
  result,
  onDismiss,
}: AIValidationBannerProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.colors;

  // Don't render when nothing ran or everything passed
  if (!result.ran || result.verdict === 'pass') return null;

  const variant = resolveVariant(result.verdict);
  const icon = resolveIcon(variant);
  const reasonKey = resolveMessageKey(result.reasonKey);
  const messageText = t(reasonKey) ?? reasonKey; // graceful fallback to raw key

  // Colour palette per variant
  const bgMap: Record<BannerVariant, string> = {
    warning:  '#FEF3C7',
    error:    '#FEE2E2',
    info:     '#EFF6FF',
  };
  const textColorMap: Record<BannerVariant, string> = {
    warning:  '#92400E',
    error:    '#991B1B',
    info:     '#1E40AF',
  };
  const iconColorMap: Record<BannerVariant, string> = {
    warning:  '#D97706',
    error:    '#DC2626',
    info:     '#2563EB',
  };

  const bg = bgMap[variant];
  const textColor = textColorMap[variant];
  const iconColor = iconColorMap[variant];

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={iconColor} style={styles.icon} />
        <Text style={[styles.message, { color: textColor }]}>{messageText}</Text>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.dismissBtn}
            aria-label="Dismiss warning"
          >
            <Ionicons name="close" size={14} color={textColor} />
          </TouchableOpacity>
        )}
      </View>


    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    // marginTop: tokens.spacing3,
    marginBottom: tokens.spacing3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing2,
  },
  icon: {
    marginTop: 1,
    flexShrink: 0,
  },
  message: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  dismissBtn: {
    padding: tokens.spacing1,
    flexShrink: 0,
  },
});