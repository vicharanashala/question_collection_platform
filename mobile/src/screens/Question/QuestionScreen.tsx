import React, { useState, useEffect } from 'react';
import { RouteProp, useNavigation, useIsFocused } from '@react-navigation/native';
import { TooltipIcon } from '../../components/TooltipIcon';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { AudioRecorder } from '../../components/AudioRecorder';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { questionApi } from '../../api/client';
import { useTranslation } from 'react-i18next';
import { DAILY_QUESTION_LIMIT, MAX_QUESTION_CHARS_FALLBACK } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';

// ─── Component ─────────────────────────────────────────────────────────────────

interface QuestionScreenProps {
  route?: RouteProp<MainTabParamList, 'AskQuestion'>;
}

export function QuestionScreen({ route }: QuestionScreenProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const { t } = useTranslation();

  const editingQuestionId = route?.params?.questionId;
  const isEditMode = Boolean(editingQuestionId);
  const isFocused = useIsFocused();

  // Every time the screen becomes visible (e.g. after returning from preview),
  // clear the input AND refresh the remaining-submissions count.
  useEffect(() => {
    if (isFocused && !isEditMode) {
      setQuestionText('');
      questionApi.getStats().then((res) => {
        const data = res.data as { remainingToday: number; maxQuestionChars?: number };
        setRemainingToday(data.remainingToday);
        if (data.maxQuestionChars) setMaxChars(data.maxQuestionChars);
      });
    }
  }, [isFocused, isEditMode]);

  // Form state
  const [questionText, setQuestionText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [remainingToday, setRemainingToday] = useState(DAILY_QUESTION_LIMIT);
  const [maxChars, setMaxChars] = useState(MAX_QUESTION_CHARS_FALLBACK);

  // Load stats on mount; fetch question if editing
  useEffect(() => {
    if (isEditMode && editingQuestionId) {
      questionApi.get(editingQuestionId).then((res) => {
        const q = res.data as Record<string, unknown>;
        setQuestionText(q.questionText as string);
      }).catch(async () => {
        const { getErrorMessage } = await import('../../api/client');
        showToast(getErrorMessage(null, t('question.updateFailed')), 'error');
        navigation.navigate('Submissions' as never);
      });
    } else {
      questionApi.getStats().then((res) => {
        const data = res.data as { remainingToday: number; maxQuestionChars?: number };
        setRemainingToday(data.remainingToday);
        if (data.maxQuestionChars) setMaxChars(data.maxQuestionChars);
      });
    }
  }, [isEditMode, editingQuestionId]);

  // ─── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!questionText.trim()) {
      errs.questionText = t('question.enterQuestion');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Preview ─────────────────────────────────────────────────────────────────

  async function handlePreview() {
    if (!validate()) return;

    if (questionText.trim().length > maxChars) {
      showToast(t('question.textTooLong', { max: maxChars }), 'warning');
      return;
    }

    if (!isEditMode && remainingToday <= 0) {
      showToast(t('question.limitReached', { limit: DAILY_QUESTION_LIMIT }), 'warning');
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await questionApi.preview({
        questionText: questionText.trim(),
        mediaType: 'none',
        mediaUrls: [],
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation as any).navigate('QuestionPreview', {
        state: res.data.state ?? user?.state ?? '',
        district: res.data.district ?? user?.district ?? '',
        block: res.data.block ?? user?.block ?? null,
        domains: res.data.domains ?? [],
        season: res.data.season ?? '',
        cropType: res.data.cropType ?? '',
        questionText: questionText.trim(),
        mediaType: 'none',
        mediaUrls: [],
        agroClimaticZone: res.data.agroClimaticZone ?? 'other',
        suggestedDistricts: res.data.suggestedDistricts ?? [],
        suggestedBlocks: res.data.suggestedBlocks ?? [],
        remainingToday: res.data.remainingToday ?? remainingToday,
        dailyLimit: res.data.dailyLimit ?? DAILY_QUESTION_LIMIT,
      } as RootStackParamList['QuestionPreview']);
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, t('question.submitFailed')), 'error');
    } finally {
      setPreviewLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: c.text }]}>
                {isEditMode ? t('question.editQuestion') : t('question.askQuestion')}
              </Text>
              <TooltipIcon
                description={isEditMode ? t('question.tooltipEdit') : t('question.tooltipAsk')}
                size={18}
              />
            </View>
            {!isEditMode && (
              <View style={styles.limitRow}>
                <View style={[styles.limitDot, { backgroundColor: c.primary }]} />
                <Text style={[styles.limitText, { color: c.textSecondary }]}>
                  {remainingToday} of {DAILY_QUESTION_LIMIT} submissions left today
                </Text>
              </View>
            )}
          </View>

          {/* Voice Input Card */}
          <View style={[styles.voiceCard, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <AudioRecorder
              onTranscribed={(text) => {
                setQuestionText(text);
                setErrors({});
              }}
              label={t('question.audioLabel') ?? 'Tap to speak your question'}
            />
          </View>

          {/* Divider with "or" text */}
          <View style={styles.orDivider}>
            <View style={[styles.orLine, { backgroundColor: c.muted }]} />
            <View style={[styles.orChip, { backgroundColor: c.muted }]}>
              <Text style={[styles.orText, { color: c.textSecondary }]}>or type below</Text>
            </View>
            <View style={[styles.orLine, { backgroundColor: c.muted }]} />
          </View>

          {/* Input card */}
          <View style={[styles.inputCard, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <Input
              placeholder={t('question.questionPlaceholder')}
              value={questionText}
              onChangeText={(v) => { setQuestionText(v); setErrors({}); }}
              error={
                errors.questionText
                  ? errors.questionText
                  : questionText.length > maxChars
                  ? `Maximum ${maxChars.toLocaleString()} characters allowed`
                  : undefined
              }
              multiline
              numberOfLines={8}
              style={{
                height: 180,
                textAlignVertical: 'top',
                paddingTop: tokens.spacing4,
                paddingHorizontal: tokens.spacing4,
                fontSize: 16,
                lineHeight: 24,
              }}
            />

            {/* Character count hint */}
            <View style={styles.hintRow}>
              <Text
                style={[
                  styles.hintText,
                  {
                    color:
                      questionText.length > maxChars
                        ? c.error
                        : questionText.length > maxChars * 0.9
                        ? '#E88B00'
                        : c.textSecondary,
                  },
                ]}
              >
                {questionText.trim().length > 0
                  ? `${questionText.trim().length} / ${maxChars}`
                  : 'Be specific — more detail to get better rewards'}
              </Text>
            </View>

            {/* Submit */}
            {!isEditMode ? (
              <Button
                title={previewLoading ? t('question.submitting') : t('continue')}
                onPress={handlePreview}
                loading={previewLoading}
                disabled={remainingToday <= 0}
              />
            ) : (
              <Button
                title={loading ? t('question.updating') : t('question.updateQuestion')}
                onPress={async () => {
                  if (!questionText.trim()) {
                    setErrors({ questionText: t('question.enterQuestion') });
                    return;
                  }
                  setLoading(true);
                  try {
                    await questionApi.update(editingQuestionId!, {
                      questionText: questionText.trim(),
                      mediaType: 'none',
                      mediaUrls: [],
                    });
                    showToast(t('question.updateSuccess'), 'success');
                    navigation.navigate('Submissions' as never);
                  } catch (err: unknown) {
                    const { getErrorMessage } = await import('../../api/client');
                    showToast(getErrorMessage(err, t('question.submitFailed')), 'error');
                  } finally {
                    setLoading(false);
                  }
                }}
                loading={loading}
              />
            )}
          </View>

          {/* Footer hint */}
          <Text style={[styles.footerHint, { color: c.textSecondary }]}>
            Questions are reviewed within 24 hours. Be clear and specific for faster approval.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: tokens.spacing6,
    paddingBottom: tokens.spacing8,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: { marginBottom: tokens.spacing6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginTop: tokens.spacing2 },
  limitDot: { width: 7, height: 7, borderRadius: 4 },
  limitText: { fontSize: 13 },

  // ── Voice Card ──────────────────────────────────────────────────────────────
  voiceCard: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing4,
    alignItems: 'center',
    marginBottom: tokens.spacing4,
  },

  // ── Divider ─────────────────────────────────────────────────────────────────
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing4,
    gap: tokens.spacing3,
  },

  orLine: { flex: 1, height: 1, borderRadius: 1 },

  orChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  orText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Input Card ──────────────────────────────────────────────────────────────
  inputCard: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing6,
    marginBottom: tokens.spacing4,
  },

  hintRow: {
    marginBottom: tokens.spacing4,
  },

  hintText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footerHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: tokens.spacing4,
  },
});