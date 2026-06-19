import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { RouteProp, useNavigation, useIsFocused } from '@react-navigation/native';
import {
  AudioModule,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { TooltipIcon } from '../../components/TooltipIcon';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { questionApi } from '../../api/client';
import api from '../../api/client';
import { useTranslation } from 'react-i18next';
import { DAILY_QUESTION_LIMIT, MAX_QUESTION_CHARS_FALLBACK } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';

// ─── Mic Button ────────────────────────────────────────────────────────────────
// Large, thumb-friendly mic button docked at the bottom of the screen.
// WhatsApp-style: always visible, secondary to the text area but
// immediately accessible without scrolling.

type MicState = 'idle' | 'recording' | 'uploading' | 'done';

const CHUNK_INTERVAL_MS = 5_000;
const MAX_RECORDING_SECONDS = 60;

interface ChunkResult { text: string; error: string | null; }

export function MicButton({ onTranscribed, disabled }: {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [state, setState] = useState<MicState>('idle');
  const recorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);
  const stoppingRef = useRef(false);
  const transcriptRef = useRef('');

  const toSarvamLang = (code: string) => {
    const map: Record<string, string> = {
      as: 'as-IN', bn: 'bn-IN', brx: 'brx-IN', doi: 'doi-IN',
      gu: 'gu-IN', hi: 'hi-IN', kn: 'kn-IN', ks: 'ks-IN',
      kok: 'kok-IN', mai: 'mai-IN', ml: 'ml-IN', mni: 'mni-IN',
      mr: 'mr-IN', ne: 'ne-IN', or: 'or-IN', pa: 'pa-IN',
      sa: 'sa-IN', sat: 'sat-IN', sd: 'sd-IN', ta: 'ta-IN',
      te: 'te-IN', ur: 'ur-IN', en: 'en-IN',
    };
    return map[code] ?? `${code}-IN`;
  };

  const uploadChunk = async (uri: string, seq: number) => {
    const formData = new (globalThis.FormData)();
    formData.append('audio', { uri, name: `chunk-${seq}.m4a`, type: 'audio/mp4' } as unknown as string);
    formData.append('languageCode', toSarvamLang(language));
    formData.append('sequenceNumber', String(seq));
    try {
      const { data } = await api.post<ChunkResult>('/speech/transcribe-chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.text) {
        transcriptRef.current = transcriptRef.current
          ? `${transcriptRef.current} ${data.text}`
          : data.text;
        onTranscribed(transcriptRef.current);
      }
    } catch { /* ignore individual chunk failures */ }
  };

  const cutAndRestart = async () => {
    const rec = recorderRef.current;
    if (!rec || stoppingRef.current) return;
    await rec.stop();
    const uri = rec.uri;
    if (uri) uploadChunk(uri, sequenceRef.current++);
    try {
      await rec.prepareToRecordAsync();
      rec.record();
    } catch { /* ignore */ }
  };

  useEffect(() => {
    return () => {
      clearInterval(chunkTimerRef.current ?? undefined);
      clearTimeout(autoStopRef.current ?? undefined);
      recorderRef.current?.stop().catch(() => {});
    };
  }, []);

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showToast(t('audio.permissionDenied') ?? 'Microphone permission required', 'error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      const rec = new AudioModule.AudioRecorder({
        extension: '.m4a',
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MAX },
        android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      });

      await rec.prepareToRecordAsync();
      rec.record();
      recorderRef.current = rec;
      stoppingRef.current = false;
      sequenceRef.current = 0;
      transcriptRef.current = '';
      setState('recording');

      chunkTimerRef.current = setInterval(cutAndRestart, CHUNK_INTERVAL_MS);
      autoStopRef.current = setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      console.error('[MicButton] start error:', err);
      showToast(t('audio.startError') ?? 'Failed to start recording', 'error');
    }
  }

  async function stopRecording() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearInterval(chunkTimerRef.current ?? undefined);
    clearTimeout(autoStopRef.current ?? undefined);

    const rec = recorderRef.current;
    if (!rec) return;

    setState('uploading');
    await rec.stop();
    const uri = rec.uri;

    if (uri) {
      const formData = new (globalThis.FormData)();
      formData.append('audio', { uri, name: 'final.m4a', type: 'audio/mp4' } as unknown as string);
      formData.append('languageCode', toSarvamLang(language));
      formData.append('sequenceNumber', String(sequenceRef.current++));
      try {
        const { data } = await api.post<ChunkResult>('/speech/transcribe-final', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (data.text) {
          transcriptRef.current = transcriptRef.current
            ? `${transcriptRef.current} ${data.text}`
            : data.text;
          onTranscribed(transcriptRef.current);
        } else if (data.error) {
          showToast(t('audio.transcribeError') ?? 'Transcription failed', 'error');
        }
      } catch {
        showToast(t('audio.transcribeError') ?? 'Transcription failed', 'error');
      }
    }

    setState('done');
    recorderRef.current = null;
    setTimeout(() => setState('idle'), 2000);
  }

  function handlePress() {
    if (disabled) return;
    if (state === 'idle' || state === 'done') startRecording();
    else if (state === 'recording') stopRecording();
  }

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const isDisabled = disabled || isUploading;

  const btnBg = isDisabled ? c.muted : isRecording ? c.error : c.primary;

  return (
    <View style={micStyles.wrap}>
      {/* Outer pulse rings while recording */}
      {isRecording && (
        <View style={[micStyles.pulseOuter, { borderColor: c.primary + '25' }]} />
      )}
      {isRecording && (
        <View style={[micStyles.pulseInner, { borderColor: c.primary + '45' }]} />
      )}

      {/* Main button */}
      <TouchableOpacity
        style={[micStyles.btn, { backgroundColor: btnBg }]}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.8}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={30}
            color={isDisabled && !isRecording ? c.textTertiary : '#fff'}
          />
        )}
      </TouchableOpacity>

      {/* Recording indicator dot */}
      {isRecording && (
        <View style={[micStyles.recordingDot, { backgroundColor: c.error }]} />
      )}
    </View>
  );
}

const micStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    position: 'relative',
  },
  pulseOuter: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
  },
  pulseInner: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
  },
  btn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  recordingDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
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

  const [questionText, setQuestionText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [remainingToday, setRemainingToday] = useState(DAILY_QUESTION_LIMIT);
  const [maxChars, setMaxChars] = useState(MAX_QUESTION_CHARS_FALLBACK);

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

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!questionText.trim()) errs.questionText = t('question.enterQuestion');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

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

  const charCountColor =
    questionText.length > maxChars
      ? c.error
      : questionText.length > maxChars * 0.9
      ? '#E88B00'
      : c.textSecondary;

  const canSubmit = questionText.trim().length > 0 && questionText.length <= maxChars && (isEditMode || remainingToday > 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Scrollable content area — text input and context */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
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
                  {remainingToday} of {DAILY_QUESTION_LIMIT} submissions remaining today
                </Text>
              </View>
            )}
          </View>

          {/* Edit mode banner */}
          {isEditMode && (
            <View style={[styles.editBanner, { backgroundColor: c.primary + '15' }]}>
              <Ionicons name="pencil" size={14} color={c.primary} />
              <Text style={[styles.editBannerText, { color: c.primary }]}>
                {t('question.editSubtitle') ?? 'You can update your question within the edit window'}
              </Text>
            </View>
          )}

          {/* Text input card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            {/* Card heading — what is the user doing here */}
            <Text style={[styles.cardHeading, { color: c.text }]}>
              {isEditMode
                ? (t('question.editModeLabel') ?? 'Updating your question')
                : (t('question.typeYourQuestion') ?? 'Type your question below')}
            </Text>

            {/* Text area */}
            <View style={styles.inputWrap}>
              <Input
                placeholder={t('question.questionPlaceholder')}
                value={questionText}
                onChangeText={(v) => { setQuestionText(v); setErrors({}); }}
                error={errors.questionText}
                multiline
                numberOfLines={6}
                style={styles.textArea}
              />
            </View>

            {/* Character count */}
            <View style={styles.charRow}>
              {questionText.trim().length > 0 ? (
                <Text style={[styles.charCount, { color: charCountColor }]}>
                  {questionText.trim().length} / {maxChars}
                </Text>
              ) : (
                <View style={styles.hintTipRow}>
                  <Ionicons name="bulb" size={14} color="#FACC15" style={{ marginRight: tokens.spacing1 }} />
                  <Text style={[styles.hintText, { color: c.text }]}>
                    Be specific and clear for faster approvals
                  </Text>
                </View>
              )}
            </View>

            {/* Over limit error */}
            {questionText.length > maxChars && (
              <Text style={[styles.overLimitText, { color: c.error }]}>
                {t('question.textTooLong', { max: maxChars })}
              </Text>
            )}

            {/* Submit button */}
            {!isEditMode ? (
              <Button
                title={previewLoading ? t('question.submitting') : t('continue')}
                onPress={handlePreview}
                loading={previewLoading}
                disabled={!canSubmit}
                icon="arrow-forward"
                iconPosition="right"
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
                icon="checkmark"
                iconPosition="right"
              />
            )}

            {/* Review hint */}
            <Text style={[styles.reviewHint, { color: c.textSecondary }]}>
              {t('question.reviewHint') ?? 'Questions are mostly reviewed within 24 hours'}
            </Text>
          </View>
        </ScrollView>

        {/* ── Mic dock — pinned to bottom ─────────────────────────────────── */}
        {/* Accessible without reaching or scrolling. Always visible when
            the keyboard is closed; stays above the keyboard when open. */}
        <View style={[styles.micDock, { backgroundColor: c.background }]}>
          {/* Divider line above mic dock */}
          <View style={[styles.micDockDivider, { backgroundColor: c.borderSubtle }]} />

          {/* Instruction text */}
          <View style={styles.micInstructionCenter}>
            {remainingToday <= 0 && !isEditMode ? (
              <Text style={[styles.micHintText, { color: c.textTertiary }]}>
                {t('question.dailyLimitReached', { total: DAILY_QUESTION_LIMIT })}
              </Text>
            ) : (
              <Text style={[styles.micHintText, { color: c.textSecondary }]}>
                {t('question.tapMicHint') ?? 'Tap the mic to speak your question'}
              </Text>
            )}
          </View>

          {/* The mic button — centered */}
          <View style={styles.micButtonCenter}>
            <MicButton
              onTranscribed={(text) => {
                setQuestionText(text);
                setErrors({});
              }}
              disabled={remainingToday <= 0 && !isEditMode}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: tokens.spacing6,
    paddingBottom: tokens.spacing4,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: { marginBottom: tokens.spacing5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    marginTop: tokens.spacing2,
  },
  limitDot: { width: 7, height: 7, borderRadius: 4 },
  limitText: { fontSize: 13 },

  // ── Edit banner ─────────────────────────────────────────────────────────────
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    gap: tokens.spacing2,
    marginBottom: tokens.spacing4,
  },
  editBannerText: { fontSize: 13, fontWeight: '500', flex: 1 },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing5,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: tokens.spacing4,
  },

  // ── Input ──────────────────────────────────────────────────────────────────
  inputWrap: { marginBottom: tokens.spacing2 },
  textArea: {
    height: 160,
    textAlignVertical: 'top',
    paddingTop: tokens.spacing4,
    paddingHorizontal: tokens.spacing3,
    fontSize: 16,
    lineHeight: 24,
  },

  // ── Character count ────────────────────────────────────────────────────────
  charRow: { marginBottom: tokens.spacing3 },
  charCount: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  hintTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hintText: { fontSize: 12, fontWeight: '500', flex: 1 },
  overLimitText: { fontSize: 12, fontWeight: '600', marginBottom: tokens.spacing2 },

  // ── Review hint ────────────────────────────────────────────────────────────
  reviewHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: tokens.spacing3,
  },

  // ── Mic dock ───────────────────────────────────────────────────────────────
  micDock: {
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing3,
    paddingBottom: tokens.spacing4,
    alignItems: 'center',
  },
  micDockDivider: {
    height: 1,
    width: '100%',
    marginBottom: tokens.spacing3,
  },
  micInstructionCenter: {
    marginBottom: tokens.spacing3,
  },
  micButtonCenter: {
    alignItems: 'center',
  },
  micHintText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});