import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  TextInput,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TooltipIcon } from '../../components/TooltipIcon';
import { DuplicateFoundModal } from '../../components/DuplicateFoundModal';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { questionApi, storageApi } from '../../api/client';
import { runOnDeviceValidation } from '../../utils/onDeviceAI';
import { AIValidationResult } from '../../utils/onDeviceAI';
import { AIValidationBanner } from '../../components/AIValidationBanner';
import { SttMicButton } from '../../components/SttMicButton';
import { AudioPlaybackCard } from '../../components/AudioPlaybackCard';
import { useTranslation } from 'react-i18next';

import { MAX_QUESTION_CHARS_FALLBACK } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';

// ─── Mic Hint Pill ────────────────────────────────────────────────────────────

function MicHintPill({ remaining, isEditMode }: { remaining: number; isEditMode: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      style={[pillStyles.pill, { backgroundColor: c.primary + '12', borderColor: c.primary + '30' }]}
      activeOpacity={0.7}
      disabled={remaining <= 0 && !isEditMode}
    >
      <Ionicons name="mic-outline" size={14} color={c.primary} />
      <Text style={[pillStyles.pillText, { color: c.primary }]}>
        {remaining <= 0 && !isEditMode
          ? t('question.dailyLimitReached', { total: 20 })
          : t('question.tapMicHint')}
      </Text>
    </TouchableOpacity>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusFull,
    borderWidth: 1,
    gap: tokens.spacing2,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

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
  const dailyLimit = 20;

  // Keyboard visibility
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Reset on focus
  useEffect(() => {
    if (isFocused && !isEditMode) {
      setQuestionText('');
      setPendingAudioUri(null);
      questionApi.getStats().then((res) => {
        const data = res.data as { remainingToday: number; maxQuestionChars?: number };
        setRemainingToday(data.remainingToday);
        if (data.maxQuestionChars) setMaxChars(data.maxQuestionChars);
      });
    }
  }, [isFocused, isEditMode]);

  // State
  const [questionText, setQuestionText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [remainingToday, setRemainingToday] = useState(dailyLimit);
  const [maxChars, setMaxChars] = useState(MAX_QUESTION_CHARS_FALLBACK);
  const [aiValidation, setAiValidation] = useState<AIValidationResult | null>(null);
  const [pendingAudioUri, setPendingAudioUri] = useState<string | null>(null);

  // GDB duplicate modal
  const [duplicateModal, setDuplicateModal] = useState({
    visible: false,
    matchedQuestion: '',
    matchedAnswer: null as string | null,
    similarityScore: null as number | null,
    submissionStatus: undefined as 'rejected' | 'found' | undefined,
  });

  // ── AI validation debounce ─────────────────────────────────────────────
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTextRef = useRef('');

  const scheduleValidation = useCallback(
    (text: string) => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      if (!text.trim() || text === prevTextRef.current) return;
      prevTextRef.current = text;
      aiDebounceRef.current = setTimeout(async () => {
        setAiValidation(await runOnDeviceValidation({ text, ownId: editingQuestionId }));
      }, 600);
    },
    [editingQuestionId],
  );

  useEffect(() => () => { if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current); }, []);

  // ── Validation ─────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!questionText.trim()) errs.questionText = t('question.enterQuestion');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handlePreview() {
    if (!validate()) return;
    if (questionText.trim().length > maxChars) {
      showToast(t('question.textTooLong', { max: maxChars }), 'warning');
      return;
    }
    if (!isEditMode && remainingToday <= 0) {
      showToast(t('question.limitReached', { limit: dailyLimit }), 'warning');
      return;
    }

    const validation = await runOnDeviceValidation({ text: questionText.trim(), ownId: editingQuestionId });
    setAiValidation(validation);
    if (validation.verdict === 'fail') {
      showToast(t(validation.reasonKey ?? 'onDeviceAI.defaultFail'), 'error');
      return;
    }
    if (validation.verdict === 'warn') return;

    setPreviewLoading(true);
    try {
      const res = await questionApi.preview({
        questionText: questionText.trim(),
        mediaType: 'none',
        mediaUrls: [],
      });

      const duplicate = res.data?.duplicate;
      if (duplicate?.isDuplicate) {
        // The preview endpoint already saved this question as REJECTED (counts as a
        // submission). Show the duplicate modal immediately — no submit call needed.
        setDuplicateModal({
          visible: true,
          matchedQuestion: duplicate.matchedQuestion ?? '',
          matchedAnswer: duplicate.matchedAnswer ?? null,
          similarityScore: duplicate.similarityScore ?? null,
          submissionStatus: 'rejected',
        });
        // Refresh remaining count
        questionApi.getStats().then((r) => {
          const d = r.data as { remainingToday: number };
          setRemainingToday(d.remainingToday);
        });
        setPreviewLoading(false);
        return;
      }

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
        pendingImageUri: null,
        pendingImageCompressed: false,
        pendingAudioUri: null,
        agroClimaticZone: res.data.agroClimaticZone ?? 'other',
        suggestedDistricts: res.data.suggestedDistricts ?? [],
        suggestedBlocks: res.data.suggestedBlocks ?? [],
        remainingToday: res.data.remainingToday ?? remainingToday,
        dailyLimit: res.data.dailyLimit ?? dailyLimit,
      } as RootStackParamList['QuestionPreview']);
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, t('question.submitFailed')), 'error');
    } finally {
      setPreviewLoading(false);
    }
  }

  const relevanceFailed = aiValidation?.verdict === 'fail' && aiValidation?.reasonKey === 'onDeviceAI.relevance.low';
  const canSubmit =
    questionText.trim().length > 0 &&
    questionText.length <= maxChars &&
    (isEditMode || remainingToday > 0) &&
    !relevanceFailed;

  const charCountColor =
    questionText.length > maxChars ? c.error
      : questionText.length > maxChars * 0.9 ? '#E88B00'
      : c.textSecondary;

  const limitPercent = Math.max(0, remainingToday / dailyLimit);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.container, { backgroundColor: c.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {/* ── Hero Header ─────────────────────────────────────────────── */}
          <View style={styles.heroHeader}>
            <View style={styles.heroTitleRow}>
              <Text style={[styles.heroTitle, { color: c.text }]}>
                {isEditMode
                  ? t("question.editQuestion")
                  : t("question.askQuestion")}
              </Text>
              <TooltipIcon
                description={
                  isEditMode
                    ? t("question.tooltipEdit")
                    : t("question.tooltipAsk")
                }
                size={20}
              />
            </View>
            {!isEditMode && (
              <View style={styles.limitBlock}>
                <View style={styles.limitLabelRow}>
                  <Text style={[styles.limitLabel, { color: c.textSecondary }]}>
                    {t("question.dailyLeftToday", {
                      remaining: remainingToday,
                      total: dailyLimit,
                    })}
                  </Text>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={c.success}
                  />
                </View>
                <View
                  style={[
                    styles.limitTrack,
                    { backgroundColor: c.borderSubtle },
                  ]}
                >
                  <View
                    style={[
                      styles.limitFill,
                      {
                        width: `${limitPercent * 100}%`,
                        backgroundColor:
                          limitPercent > 0.3 ? c.primary : c.error,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
            {isEditMode && (
              <View
                style={[
                  styles.editBadge,
                  { backgroundColor: c.primary + "15" },
                ]}
              >
                <Ionicons name="pencil" size={13} color={c.primary} />
                <Text style={[styles.editBadgeText, { color: c.primary }]}>
                  {t("question.editSubtitle")}
                </Text>
              </View>
            )}
          </View>

          {/* ── Question Input ─────────────────────────────────────────────── */}
          <View style={styles.inputWrap}>
            <TextInput
              placeholder={t("question.questionPlaceholder")}
              placeholderTextColor={c.textTertiary}
              value={questionText}
              onChangeText={(v) => {
                setQuestionText(v);
                setErrors({});
                if (!v.trim()) {
                  setAiValidation(null);
                  if (aiDebounceRef.current)
                    clearTimeout(aiDebounceRef.current);
                } else {
                  scheduleValidation(v);
                }
              }}
              multiline
              textAlignVertical="top"
              style={[
                styles.textarea,
                {
                  color: c.text,
                  backgroundColor: c.surfaceVariant,
                  borderColor: errors.questionText ? c.error : c.borderSubtle,
                },
              ]}
            />
            <View style={styles.inputMeta}>
              {questionText.length > maxChars && (
                <Text style={[styles.overLimit, { color: c.error }]}>
                  {t("question.textTooLong", { max: maxChars })}
                </Text>
              )}
              {questionText.trim().length > 0 && (
                <Text style={[styles.charCount, { color: charCountColor }]}>
                  {questionText.trim().length} / {maxChars}
                </Text>
              )}
            </View>
          </View>

          {/* ── AI Validation ─────────────────────────────────────────── */}
          <AIValidationBanner
            result={
              aiValidation ?? {
                verdict: "pass",
                message: null,
                reasonKey: null,
                stages: {
                  relevance: { pass: true, confidence: 1 },
                  duplicate: { pass: true, confidence: 1 },
                  spam: { pass: true, confidence: 1 },
                },
                ran: false,
              }
            }
            onDismiss={() => setAiValidation(null)}
          />

          {/* ── Continue ───────────────────────────────────────────────── */}
          <Button
            title={
              previewLoading
                ? t("question.submitting")
                : relevanceFailed
                  ? t("question.notRelevant")
                  : t("continue")
            }
            onPress={handlePreview}
            loading={previewLoading}
            disabled={
              !canSubmit ||
              relevanceFailed ||
              aiValidation?.verdict === "warn"
            }
            icon="arrow-forward"
            iconPosition="right"
            size="lg"
            style={styles.continueBtn}
          />


        </ScrollView>

        {/* ── Bottom Dock — hidden when keyboard open ─────────────────────── */}
        {!isKeyboardVisible && (
          <View
            style={[
              styles.bottomDock,
              { backgroundColor: c.background, borderTopColor: c.borderSubtle },
            ]}
          >
            {/* Audio bar — shown when recording exists */}
            {pendingAudioUri && (
              <View style={styles.audioBarWrap}>
                <AudioPlaybackCard
                  uri={pendingAudioUri}
                  onDelete={() => {
                    setPendingAudioUri(null);
                    setQuestionText('');
                    setErrors({});
                    setAiValidation(null);
                  }}
                />
              </View>
            )}

            {/* Mic row */}
            <View style={styles.micRow}>
              <SttMicButton
                onTranscribed={(text) => {
                  setQuestionText((prev) => {
                    const next = prev.trim() ? `${prev.trim()} ${text}` : text;
                    setErrors({});
                    scheduleValidation(next);
                    return next;
                  });
                }}
                onRecordingStart={() => {
                  setPendingAudioUri(null);
                  setErrors({});
                  setAiValidation(null);
                }}
                onRecordingComplete={async (uri, durationMs) => {
                  console.log('[QuestionScreen] onRecordingComplete called with uri:', uri, 'durationMs:', durationMs);
                  setPendingAudioUri(null); // clear while uploading
                  try {
                    const filename = `question-audio-${Date.now()}.aac`;
                    console.log('[QuestionScreen] uploading audio uri:', uri, 'filename:', filename);
                    const { url } = await storageApi.uploadAudio(uri, filename);
                    console.log('[QuestionScreen] upload success, url:', url);
                    setPendingAudioUri(url + '?dur=' + Math.round(durationMs));
                  } catch (err) {
                    // upload failed — store local URI as fallback
                    console.error('[QuestionScreen] upload failed, using local URI:', err);
                    setPendingAudioUri(uri + '?dur=' + Math.round(durationMs));
                  }
                }}
                disabled={remainingToday <= 0 && !isEditMode}
              />
              <MicHintPill remaining={remainingToday} isEditMode={isEditMode} />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <DuplicateFoundModal
        visible={duplicateModal.visible}
        matchedQuestion={duplicateModal.matchedQuestion}
        matchedAnswer={duplicateModal.matchedAnswer}
        similarityScore={duplicateModal.similarityScore}
        submissionStatus={duplicateModal.submissionStatus}
        onDismiss={() => {
          setDuplicateModal((p) => ({ ...p, visible: false }));
          setQuestionText("");
          setPendingAudioUri(null);
          setAiValidation(null);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing5,
    paddingBottom: tokens.spacing4,
  },

  // Hero header
  heroHeader: {
    marginBottom: tokens.spacing5,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    marginBottom: tokens.spacing4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    flex: 1,
  },

  // Limit indicator
  limitBlock: {
    gap: tokens.spacing2,
  },
  limitLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limitLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  limitTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  limitFill: {
    height: 5,
    borderRadius: 3,
  },

  // Edit badge
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    gap: tokens.spacing2,
    alignSelf: 'flex-start',
  },
  editBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Question input
  inputWrap: {
    marginBottom: tokens.spacing3,
  },
  textarea: {
    minHeight: 240,
    maxHeight: SCREEN_H * 0.35,
    borderWidth: 1.5,
    borderRadius: tokens.radiusLg,
    paddingHorizontal: tokens.spacing5,
    paddingVertical: tokens.spacing5,
    fontSize: 18,
    lineHeight: 28,
    textAlignVertical: 'top',
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: tokens.spacing2,
    gap: tokens.spacing3,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  overLimit: {
    fontSize: 12,
    fontWeight: '600',
  },

  continueBtn: {
    borderRadius: tokens.radiusMd,
  },


  // Bottom dock
  bottomDock: {
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing3,
    paddingBottom: tokens.spacing5,
    borderTopWidth: 1,
  },
  audioBarWrap: {
    marginBottom: tokens.spacing5,
  },
  micRow: {
    alignItems: 'center',
    gap: tokens.spacing3,
  },
});