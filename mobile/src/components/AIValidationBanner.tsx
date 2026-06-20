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
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AIValidationResult } from '../utils/onDeviceAI';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

interface AIValidationBannerProps {
  result: AIValidationResult;
  /** Called when user taps "Submit Anyway" — only when verdict === 'warn' */
  onOverride?: () => void;
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
  onOverride,
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

      {result.verdict === 'warn' && onOverride && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.overrideBtn, { borderColor: textColor }]}
            onPress={onOverride}
            activeOpacity={0.7}
          >
            <Text style={[styles.overrideBtnText, { color: textColor }]}>
              {t('onDeviceAI.submitAnyway') ?? 'Submit Anyway'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stage-by-stage confidence strip — only shown in warn mode */}
      {result.verdict === 'warn' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stageScrollContent}
        >
          <View style={styles.stageStrip}>
            {(
              [
                { key: 'relevance', label: t('onDeviceAI.stage.relevance') ?? 'Relevance' },
                { key: 'duplicate', label: t('onDeviceAI.stage.duplicate') ?? 'Duplicate' },
                { key: 'spam',      label: t('onDeviceAI.stage.spam')      ?? 'Spam' },
              ] as const
            ).map(({ key, label }) => {
              const stage = result.stages[key];
              const pass = stage.pass;
              return (
                <View key={key} style={styles.stageItem}>
                  <View
                    style={[
                      styles.stageDot,
                      { backgroundColor: pass ? '#16A34A' : '#DC2626' },
                    ]}
                  />
                  <Text style={[styles.stageLabel, { color: textColor }]}>{label}</Text>
                  <Text
                    style={[
                      styles.stageScore,
                      { color: pass ? '#16A34A' : '#DC2626' },
                    ]}
                  >
                    {Math.round(stage.confidence * 100)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    marginTop: tokens.spacing3,
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
  actions: {
    marginTop: tokens.spacing3,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  overrideBtn: {
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing2,
  },
  overrideBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Stage confidence strip
  stageStrip: {
    flexDirection: 'row',
    gap: tokens.spacing3,
    alignItems: 'center',
    marginTop: tokens.spacing3,
    paddingTop: tokens.spacing3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  stageScrollContent: {
    flexDirection: 'row',
    paddingRight: tokens.spacing2,
    marginBottom: tokens.spacing2,
  },
  stageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing1,
  },
  stageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stageLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  stageScore: {
    fontSize: 12,
    fontWeight: '700',
  },
});