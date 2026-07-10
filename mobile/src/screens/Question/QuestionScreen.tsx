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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useIsFocused } from '@react-navigation/native';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';
import { AudioRecorder } from '../../components/AudioRecorder';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TooltipIcon } from '../../components/TooltipIcon';
import { DuplicateFoundModal } from '../../components/DuplicateFoundModal';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { questionApi } from '../../api/client';
import { runOnDeviceValidation } from '../../utils/onDeviceAI';
import { AIValidationResult } from '../../utils/onDeviceAI';
import { AIValidationBanner } from '../../components/AIValidationBanner';
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
          : t('question.tapMicHint') ?? 'Tap mic to speak'}
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── AudioPreview Inline ──────────────────────────────────────────────────────

function AudioInlineBar({
  uri,
  onDelete,
  duration,
}: {
  uri: string;
  onDelete: () => void;
  duration: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);
  const totalSec = duration;

  async function togglePlay() {
    if (playing) {
      playerRef.current?.pause();
      setPlaying(false);
      return;
    }
    const player = createAudioPlayer(uri, { updateInterval: 250 });
    player.addListener('playbackStatusUpdate', (status) => {
      setCurrentSec(status.currentTime);
      if (status.didJustFinish) {
        player.remove();
        playerRef.current = null;
        setPlaying(false);
        setCurrentSec(0);
      }
    });
    await player.play();
    playerRef.current = player;
    setPlaying(true);
  }

  useEffect(() => {
    return () => { playerRef.current?.remove(); playerRef.current = null; };
  }, []);

  const progress = totalSec > 0 ? Math.min(currentSec / totalSec, 1) : 0;

  return (
    <View style={[audioStyles.bar, { backgroundColor: c.surfaceVariant, borderColor: c.borderSubtle }]}>
      {/* Play button */}
      <TouchableOpacity
        style={[audioStyles.playBtn, { backgroundColor: c.primary }]}
        onPress={togglePlay}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={16} color="#fff" />
      </TouchableOpacity>

      {/* Progress + time */}
      <View style={audioStyles.progressWrap}>
        <View style={[audioStyles.track, { backgroundColor: c.borderSubtle }]}>
          <View style={[audioStyles.fill, { width: `${progress * 100}%`, backgroundColor: c.primary }]} />
        </View>
        <Text style={[audioStyles.time, { color: c.textSecondary }]}>
          {formatTime(currentSec)} / {formatTime(totalSec)}
        </Text>
      </View>

      {/* Delete */}
      <TouchableOpacity
        style={audioStyles.deleteBtn}
        onPress={() => { playerRef.current?.remove(); playerRef.current = null; onDelete(); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={c.error} />
      </TouchableOpacity>
    </View>
  );
}

const audioStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: tokens.radiusFull,
    paddingVertical: tokens.spacing2,
    paddingLeft: tokens.spacing2,
    paddingRight: tokens.spacing3,
    gap: tokens.spacing2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressWrap: {
    flex: 1,
    gap: 4,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
  },
  deleteBtn: {
    padding: tokens.spacing1,
    flexShrink: 0,
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
  const [pendingAudioUri, setPendingAudioUri] = useState<string | null>(null);
  const [aiValidation, setAiValidation] = useState<AIValidationResult | null>(null);

  // GDB duplicate modal
  const [duplicateModal, setDuplicateModal] = useState({
    visible: false,
    matchedQuestion: '',
    matchedAnswer: null as string | null,
    similarityScore: null as number | null,
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
      showToast(t(validation.reasonKey ?? 'onDeviceAI.defaultFail') ?? t('onDeviceAI.defaultFail'), 'error');
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
        setDuplicateModal({
          visible: true,
          matchedQuestion: duplicate.matchedQuestion ?? '',
          matchedAnswer: duplicate.matchedAnswer ?? null,
          similarityScore: duplicate.similarityScore ?? null,
        });
        setPreviewLoading(false);
        return;
      }

      const hasAudio = Boolean(pendingAudioUri);
      (navigation as any).navigate('QuestionPreview', {
        state: res.data.state ?? user?.state ?? '',
        district: res.data.district ?? user?.district ?? '',
        block: res.data.block ?? user?.block ?? null,
        domains: res.data.domains ?? [],
        season: res.data.season ?? '',
        cropType: res.data.cropType ?? '',
        questionText: questionText.trim(),
        mediaType: hasAudio ? 'audio' : 'none',
        mediaUrls: [],
        pendingImageUri: null,
        pendingImageCompressed: false,
        pendingAudioUri,
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
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                {isEditMode ? t('question.editQuestion') : t('question.askQuestion')}
              </Text>
              <TooltipIcon
                description={isEditMode ? t('question.tooltipEdit') : t('question.tooltipAsk')}
                size={20}
              />
            </View>
            {!isEditMode && (
              <View style={styles.limitBlock}>
                <View style={styles.limitLabelRow}>
                  <Text style={[styles.limitLabel, { color: c.textSecondary }]}>
                    {remainingToday} of {dailyLimit} left today
                  </Text>
                  <Ionicons name="checkmark-circle" size={14} color={c.success} />
                </View>
                <View style={[styles.limitTrack, { backgroundColor: c.borderSubtle }]}>
                  <View
                    style={[
                      styles.limitFill,
                      {
                        width: `${limitPercent * 100}%`,
                        backgroundColor: limitPercent > 0.3 ? c.primary : c.error,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
            {isEditMode && (
              <View style={[styles.editBadge, { backgroundColor: c.primary + '15' }]}>
                <Ionicons name="pencil" size={13} color={c.primary} />
                <Text style={[styles.editBadgeText, { color: c.primary }]}>
                  {t('question.editSubtitle') ?? 'Update within the edit window'}
                </Text>
              </View>
            )}
          </View>

          {/* ── Input Card ───────────────────────────────────────────────── */}
          <View style={[styles.inputCard, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            {/* Question textarea */}
            <View style={styles.textareaWrap}>
              <TextInput
                placeholder={t('question.questionPlaceholder')}
                placeholderTextColor={c.textTertiary}
                value={questionText}
                onChangeText={(v) => {
                  setQuestionText(v);
                  setErrors({});
                  if (!v.trim()) {
                    setAiValidation(null);
                    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
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
            </View>

            {/* Character count */}
            <View style={styles.charRow}>
              {questionText.trim().length > 0 && (
                <Text style={[styles.charCount, { color: charCountColor }]}>
                  {questionText.trim().length} / {maxChars}
                </Text>
              )}
            </View>

            {questionText.length > maxChars && (
              <Text style={[styles.overLimit, { color: c.error }]}>
                {t('question.textTooLong', { max: maxChars })}
              </Text>
            )}

            {/* AI validation banner */}
            <AIValidationBanner
              result={
                aiValidation ?? {
                  verdict: 'pass',
                  message: null,
                  reasonKey: null,
                  stages: { relevance: { pass: true, confidence: 1 }, duplicate: { pass: true, confidence: 1 }, spam: { pass: true, confidence: 1 } },
                  ran: false,
                }
              }
              onDismiss={() => setAiValidation(null)}
            />

            {/* Continue button */}
            <Button
              title={
                previewLoading
                  ? t('question.submitting')
                  : relevanceFailed
                  ? (t('question.notRelevant') ?? 'Not Relevant')
                  : t('continue')
              }
              onPress={handlePreview}
              loading={previewLoading}
              disabled={!canSubmit || relevanceFailed || aiValidation?.verdict === 'warn'}
              icon="arrow-forward"
              iconPosition="right"
              size="lg"
              style={styles.continueBtn}
            />

            <Text style={[styles.reviewHint, { color: c.textTertiary }]}>
              {t('question.reviewHint') ?? 'Reviewed within 24 hours'}
            </Text>
          </View>

          {/* ── Quick tips ───────────────────────────────────────────────── */}
          {!questionText.trim() && (
            <View style={styles.tipsSection}>
              {[
                { icon: 'bulb-outline', tip: 'Be specific — mention crop name, symptoms & soil type' },
                { icon: 'shield-checkmark-outline', tip: 'Avoid personal info — stay farming-related' },
              ].map((item, i) => (
                <View key={i} style={[styles.tipRow, { backgroundColor: c.surfaceVariant + '80' }]}>
                  <Ionicons name={item.icon as any} size={15} color={c.textTertiary} />
                  <Text style={[styles.tipText, { color: c.textSecondary }]}>{item.tip}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* ── Bottom Dock — hidden when keyboard open ─────────────────────── */}
        {!isKeyboardVisible && (
          <View style={[styles.bottomDock, { backgroundColor: c.background, borderTopColor: c.borderSubtle }]}>
            {/* Audio bar — shown when recording exists */}
            {pendingAudioUri && (
              <View style={styles.audioBarWrap}>
                <AudioInlineBar
                  uri={pendingAudioUri}
                  duration={0}
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
              <AudioRecorder
                label=""
                onTranscribed={(text) => {
                  setQuestionText(text);
                  setErrors({});
                  scheduleValidation(text);
                }}
                onRecordingComplete={(uri) => setPendingAudioUri(uri)}
                onRecordingStart={() => {
                  setPendingAudioUri(null);
                  setErrors({});
                  setAiValidation(null);
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
        onDismiss={() => {
          setDuplicateModal((p) => ({ ...p, visible: false }));
          setQuestionText('');
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

  // Input card
  inputCard: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing5,
  },
  textareaWrap: { marginBottom: tokens.spacing2 },
  textarea: {
    minHeight: 140,
    maxHeight: SCREEN_H * 0.35,
    borderWidth: 1.5,
    borderRadius: tokens.radiusLg,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing4,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: tokens.spacing2,
  },
  charCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  overLimit: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: tokens.spacing2,
  },

  continueBtn: {
    marginTop: tokens.spacing2,
    borderRadius: tokens.radiusMd,
  },
  reviewHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: tokens.spacing3,
    lineHeight: 17,
  },

  // Quick tips
  tipsSection: {
    marginTop: tokens.spacing5,
    gap: tokens.spacing2,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderRadius: tokens.radiusMd,
    gap: tokens.spacing3,
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Bottom dock
  bottomDock: {
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing3,
    paddingBottom: tokens.spacing5,
    borderTopWidth: 1,
  },
  audioBarWrap: {
    marginBottom: tokens.spacing3,
  },
  micRow: {
    alignItems: 'center',
    gap: 2,
  },
});