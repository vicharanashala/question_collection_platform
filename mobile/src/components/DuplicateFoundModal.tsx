import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { tokens } from '../utils/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ANSWER_PREVIEW_CHARS = 280;

export interface DuplicateFoundModalProps {
  visible: boolean;
  /** The text of the matching question that already exists */
  matchedQuestion: string;
  /** The answer / stored text for the matched question */
  matchedAnswer: string | null;
  /** Similarity score from the GDB (0–1) */
  similarityScore: number | null;
  onDismiss: () => void;
}

export function DuplicateFoundModal({
  visible,
  matchedQuestion,
  matchedAnswer,
  similarityScore,
  onDismiss,
}: DuplicateFoundModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();

  const [answerExpanded, setAnswerExpanded] = useState(false);

  // Reset accordion state when modal opens
  React.useEffect(() => {
    if (visible) setAnswerExpanded(false);
  }, [visible]);

  const scorePct = similarityScore != null ? Math.round(similarityScore * 100) : null;
  const hasAnswer = Boolean(matchedAnswer?.trim());
  const answerLong = (matchedAnswer?.length ?? 0) > ANSWER_PREVIEW_CHARS;
  const answerPreview = hasAnswer
    ? answerLong && !answerExpanded
      ? matchedAnswer!.slice(0, ANSWER_PREVIEW_CHARS).trim() + '…'
      : matchedAnswer!.trim()
    : '';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <View style={[styles.dialog, { backgroundColor: c.background }]}>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: '#FACC15' + '22' }]}>
              <Ionicons name="search" size={22} color="#B45309" />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>
                {t('question.duplicateFoundTitle')}
              </Text>
              {scorePct != null && (
                <View style={[styles.scoreBadge, { backgroundColor: '#FACC15' + '18', borderColor: '#FACC15' + '60' }]}>
                  <Text style={[styles.scoreText, { color: '#92400E' }]}>{scorePct}% match</Text>
                </View>
              )}
            </View>
          </View>

          {/* Appreciation note */}
          <Text style={[styles.appreciation, { color: c.textSecondary }]}>
            Thank you for taking the time to submit a question! A similar question has already been answered by our experts — please review it below.
          </Text>

          <View style={[styles.divider, { backgroundColor: c.borderSubtle }]} />

          {/* Question */}
          <View style={styles.qaSection}>
            <View style={styles.qaLabelRow}>
              <Ionicons name="help-circle" size={14} color={c.primary} />
              <Text style={[styles.qaLabel, { color: c.primary }]}>Question</Text>
            </View>
            <Text style={[styles.questionText, { color: c.text }]}>{matchedQuestion}</Text>
          </View>

          {/* Answer — accordion */}
          {hasAnswer && (
            <View style={styles.qaSection}>
              <View style={styles.qaLabelRow}>
                <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
                <Text style={[styles.qaLabel, { color: '#16a34a' }]}>Answer</Text>
              </View>

              <ScrollView
                style={[
                  styles.answerScroll,
                  answerExpanded && styles.answerScrollExpanded,
                ]}
                contentContainerStyle={styles.answerScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled
              >
                <Text style={[styles.answerText, { color: c.textSecondary }]}>
                  {answerPreview}
                </Text>
              </ScrollView>

              {answerLong && (
                <TouchableOpacity
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setAnswerExpanded((p) => !p);
                  }}
                  activeOpacity={0.65}
                >
                  <Text style={[styles.readMore, { color: c.primary }]}>
                    {answerExpanded
                      ? 'Read less ▲'
                      : 'Read more ▼'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: c.borderSubtle }]} />

          {/* Actions */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#B45309' }]}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={[styles.btnText, { color: '#fff' }]}>
              {t('question.tryAnotherQuestion', 'Try Another Question')}
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
  scoreBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: tokens.radiusSm,
    paddingVertical: 2,
    paddingHorizontal: tokens.spacing2,
  },
  scoreText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: tokens.spacing1,
  },
  qaSection: {
    gap: tokens.spacing2,
  },
  qaLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing1,
  },
  qaLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '500',
  },
  appreciation: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  answerText: {
    fontSize: 14,
    lineHeight: 21,
  },
  answerScroll: {
    maxHeight: 120,
    borderRadius: tokens.radiusMd,
    backgroundColor: '#16a34a08',
  },
  answerScrollExpanded: {
    maxHeight: 260,
  },
  answerScrollContent: {
    padding: tokens.spacing3,
    paddingTop: tokens.spacing2,
  },
  readMore: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: tokens.spacing1,
  },
  btn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing3 + 2,
    borderRadius: tokens.radiusMd,
  },
  btnText: {
    fontSize: 15.5,
    fontWeight: '700',
  },
});