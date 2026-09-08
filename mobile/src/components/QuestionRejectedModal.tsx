import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { tokens } from '../utils/theme';
import type { QuestionRejectionCategory } from '../api/client';

export interface QuestionRejectedModalProps {
  visible: boolean;
  /** Why the content check blocked the question */
  category: QuestionRejectionCategory;
  /** The text the user tried to submit, echoed back so they can correct it */
  questionText: string;
  onDismiss: () => void;
}

const CATEGORY_COPY: Record<
  QuestionRejectionCategory,
  { icon: keyof typeof Ionicons.glyphMap; accent: string; titleKey: string; titleFallback: string; bodyKey: string; bodyFallback: string }
> = {
  ABUSIVE: {
    icon: 'warning',
    accent: '#DC2626',
    titleKey: 'question.rejectedAbusiveTitle',
    titleFallback: 'Please rephrase your question',
    bodyKey: 'question.rejectedAbusiveMessage',
    bodyFallback:
      'Your question contains language we cannot accept. Please remove any offensive words and ask your farming question politely.',
  },
  NOT_AGRICULTURE: {
    icon: 'leaf',
    accent: '#B45309',
    titleKey: 'question.rejectedNotAgriTitle',
    titleFallback: 'Not a farming question',
    bodyKey: 'question.rejectedNotAgriMessage',
    bodyFallback:
      'We can only answer questions about farming — crops, livestock, soil, pests, weather and related topics. Please ask a farming question.',
  },
  OTHER: {
    icon: 'alert-circle',
    accent: '#B45309',
    titleKey: 'question.rejectedOtherTitle',
    titleFallback: 'Question could not be accepted',
    bodyKey: 'question.rejectedOtherMessage',
    bodyFallback: 'We could not accept this question. Please rewrite it and try again.',
  },
};

/**
 * Shown when the backend content check blocks a submission as abusive or
 * non-agricultural. The question is not saved and no daily slot is used, so the
 * only action is to go back and edit the text.
 */
export function QuestionRejectedModal({
  visible,
  category,
  questionText,
  onDismiss,
}: QuestionRejectedModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();

  const copy = CATEGORY_COPY[category] ?? CATEGORY_COPY.OTHER;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: c.background }]}>

          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: copy.accent + '22' }]}>
              <Ionicons name={copy.icon} size={22} color={copy.accent} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>
                {t(copy.titleKey, copy.titleFallback)}
              </Text>
              <Text style={[styles.notCountedText, { color: c.textSecondary }]}>
                {t('question.rejectedNotCounted', 'This was not submitted and does not count against your daily limit.')}
              </Text>
            </View>
          </View>

          <Text style={[styles.body, { color: c.textSecondary }]}>
            {t(copy.bodyKey, copy.bodyFallback)}
          </Text>

          {Boolean(questionText.trim()) && (
            <View style={[styles.quoteBox, { borderColor: c.borderSubtle }]}>
              <Text style={[styles.quoteLabel, { color: c.textSecondary }]}>
                {t('question.rejectedYourQuestion', 'Your question')}
              </Text>
              <Text style={[styles.quoteText, { color: c.text }]} numberOfLines={4}>
                {questionText.trim()}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: c.primary }]}
            onPress={onDismiss}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>
              {t('question.rejectedEditQuestion', 'Edit My Question')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing5,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
    gap: tokens.spacing4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing3,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: tokens.spacing1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  notCountedText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  quoteBox: {
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    gap: tokens.spacing1,
  },
  quoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 19,
  },
  btn: {
    borderRadius: tokens.radiusLg,
    paddingVertical: tokens.spacing3,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
