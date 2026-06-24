import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { tokens } from '../utils/theme';

/** Props for the DuplicateFoundModal */
export interface DuplicateFoundModalProps {
  visible: boolean;
  /** The text of the matching question that already exists */
  matchedQuestion: string;
  /** The answer / stored text for the matched question */
  matchedAnswer: string | null;
  /** Similarity score from the GDB (0–1), displayed if provided */
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

  const scorePct = similarityScore != null ? Math.round(similarityScore * 100) : null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <View style={[styles.dialog, { backgroundColor: c.background }]}>
          {/* Header icon */}
          <View style={[styles.iconWrap, { backgroundColor: '#FACC15' + '20' }]}>
            <Ionicons name="search" size={28} color="#B45309" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: c.text }]}>
            {t('question.duplicateFoundTitle')}
          </Text>

          {/* Score badge */}
          {scorePct != null && (
            <View style={[styles.scoreBadge, { backgroundColor: '#FACC15' + '18', borderColor: '#FACC15' }]}>
              <Text style={[styles.scoreText, { color: '#92400E' }]}>
                {scorePct}% match
              </Text>
            </View>
          )}

          {/* Description */}
          <Text style={[styles.message, { color: c.textSecondary }]}>
            {t('question.duplicateFoundMessage')}
          </Text>

          {/* Matched question card */}
          {/* <View style={[styles.card, { backgroundColor: c.surfaceVariant, borderColor: c.border }]}>
            <Text style={[styles.cardLabel, { color: c.textTertiary }]}>
              {matchedQuestion.length > 60
                ? matchedQuestion.slice(0, 60) + '…'
                : matchedQuestion}
            </Text>
          </View> */}

          {/* Answer section */}
          {/* {matchedAnswer && (
            <View style={styles.answerSection}>
              <View style={styles.answerHeader}>
                <Ionicons name="checkmark-circle" size={15} color="#16a34a" />
                <Text style={[styles.answerLabel, { color: '#16a34a' }]}>
                  {t('question.duplicateFoundAnswer')}
                </Text>
              </View>
              <ScrollView
                style={[styles.answerScroll, { backgroundColor: '#16a34a' + '10', borderColor: '#16a34a' + '30' }]}
                nestedScrollEnabled
              >
                <Text style={[styles.answerText, { color: c.text }]}>
                  {matchedAnswer}
                </Text>
              </ScrollView>
            </View>
          )} */}

          {/* Dismiss button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#B45309' }]}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={16} color="#fff" style={{ marginRight: tokens.spacing2 }} />
            <Text style={styles.btnText}>{t('question.duplicateDismiss')}</Text>
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
    alignItems: 'center',
    gap: tokens.spacing3,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  scoreBadge: {
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing1,
    paddingHorizontal: tokens.spacing3,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  answerSection: {
    width: '100%',
    gap: tokens.spacing2,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing1,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  answerScroll: {
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
  },
  answerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing3 + 2,
    borderRadius: tokens.radiusMd,
    marginTop: tokens.spacing1,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});