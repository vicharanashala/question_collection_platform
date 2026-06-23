import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useIsFocused } from '@react-navigation/native';
import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, AudioQuality, IOSOutputFormat, AudioPlayer } from 'expo-audio';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { TooltipIcon } from '../../components/TooltipIcon';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { questionApi, storageApi } from '../../api/client';
import api from '../../api/client';
import { runOnDeviceValidation, cacheQuestionForDuplicateDetection } from '../../utils/onDeviceAI';
import { AIValidationResult } from '../../utils/onDeviceAI';
import { AIValidationBanner } from '../../components/AIValidationBanner';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity as ImgTouchableOpacity } from 'react-native';
import { compressImage, getImageSizeMB } from '../../utils/media';
import { MAX_QUESTION_CHARS_FALLBACK } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── MicButton ─────────────────────────────────────────────────────────────────
// WhatsApp-style: tap to record, tap again to stop. No rolling chunks.
// On stop, the full audio is sent to Sarvam for transcription + returned as a URI.

type MicState = 'idle' | 'recording' | 'processing' | 'done';

export function MicButton({ onTranscribed, disabled, onRecordingDeleted, onRecordingComplete }: { onTranscribed: (text: string) => void; disabled?: boolean; onRecordingDeleted: () => void; onRecordingComplete: (uri: string) => void }) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [state, setState] = useState<MicState>('idle');
  // Local copy of the URI — QuestionScreen keeps its own copy (pendingAudioUri).
  const [localAudioUri, setLocalAudioUri] = useState<string | null>(null);
  const recorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
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
      setState('recording');

      // Hard auto-stop after 60 seconds
      autoStopRef.current = setTimeout(stopRecording, 60_000);
    } catch (err) {
      console.error('[MicButton] start error:', err);
      showToast(t('audio.startError') ?? 'Failed to start recording', 'error');
    }
  }

  async function stopRecording() {
    clearTimeout(autoStopRef.current ?? undefined);
    const rec = recorderRef.current;
    if (!rec) return;

    setState('processing');
    await rec.stop();
    const uri = rec.uri ?? '';

    // Immediately show AudioPreview so user can hear their recording right away.
    if (uri) {
      setLocalAudioUri(uri);
      onRecordingComplete(uri);
    }

    // Send the full recording to Sarvam for transcription in the background.
    if (uri) {
      const formData = new (globalThis.FormData)();
      formData.append('audio', { uri, name: 'recording.m4a', type: 'audio/mp4' } as unknown as string);
      formData.append('languageCode', toSarvamLang(language));

      try {
        const { data } = await api.post<{ text?: string; error?: string }>(
          '/speech/transcribe-final',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        if (data.text) {
          onTranscribed(data.text);
        } else if (data.error) {
          showToast(t('audio.transcribeError') ?? 'Transcription failed', 'error');
        }
      } catch {
        showToast(t('audio.transcribeError') ?? 'Transcription failed', 'error');
      }
    }

    recorderRef.current = null;
    setState('done');
    setTimeout(() => setState('idle'), 3000);
  }

  function handlePress() {
    if (disabled) return;
    if (state === 'idle' || state === 'done') startRecording();
    else if (state === 'recording') stopRecording();
  }

  function handleDelete() {
    setLocalAudioUri(null);
    onRecordingDeleted();
    onTranscribed('');
  }

  const isRecording = state === 'recording';
  const isProcessing = state === 'processing';
  const isDisabled = disabled || isProcessing;
  const btnBg = isDisabled ? c.muted : isRecording ? c.error : c.primary;

  return (
    <View style={micStyles.wrap}>
      {isRecording && <View style={[micStyles.pulseOuter, { borderColor: c.primary + '25' }]} />}
      {isRecording && <View style={[micStyles.pulseInner, { borderColor: c.primary + '45' }]} />}
      <TouchableOpacity
        style={[micStyles.btn, { backgroundColor: btnBg }]}
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.8}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={30}
            color={isDisabled && !isRecording ? c.textTertiary : '#fff'}
          />
        )}
      </TouchableOpacity>
      {isRecording && <View style={[micStyles.recordingDot, { backgroundColor: c.error }]} />}
    </View>
  );
}

const micStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 72, height: 72, position: 'relative' },
  pulseOuter: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2 },
  pulseInner: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1.5 },
  btn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, zIndex: 1,
  },
  recordingDot: {
    position: 'absolute', bottom: 6, right: 6,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: '#fff', zIndex: 2,
  },
});

// ─── AudioPreview ──────────────────────────────────────────────────────────────
// Full-featured playback view: play/pause, seekable progress bar, duration,
// delete, and a close button.

function AudioPreview({ uri, onDelete, onClose }: { uri: string; onDelete: () => void; onClose?: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);

  const progress = totalSec > 0 ? Math.min(currentSec / totalSec, 1) : 0;

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function togglePlay() {
    try {
      if (playing) {
        playerRef.current?.pause();
        setPlaying(false);
        return;
      }
      const player = new AudioPlayer({ uri });
      player.addListener('playbackStatusUpdate', (status) => {
        setCurrentSec(status.currentTime ?? 0);
        setTotalSec(status.duration ?? 0);
        if (status.currentTime !== undefined && status.duration !== undefined) {
          if (status.currentTime >= status.duration && status.duration > 0) {
            player.remove();
            playerRef.current = null;
            setPlaying(false);
            setCurrentSec(0);
          }
        }
      });
      await player.play();
      playerRef.current = player;
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  useEffect(() => () => { playerRef.current?.remove(); }, []);

  return (
    <View style={[audioPreviewStyles.wrap, { backgroundColor: c.surface, borderColor: c.borderSubtle }]}>
      {/* Header row */}
      <View style={audioPreviewStyles.headerRow}>
        <Text style={[audioPreviewStyles.title, { color: c.text }]}>
          {t('question.yourRecording') ?? 'Your recording'}
        </Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={22} color={c.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={audioPreviewStyles.progressRow}>
        <View style={[audioPreviewStyles.track, { backgroundColor: c.borderSubtle }]}>
          <View style={[audioPreviewStyles.fill, { width: `${progress * 100}%`, backgroundColor: c.primary }]} />
        </View>
        <Text style={[audioPreviewStyles.time, { color: c.textSecondary }]}>
          {formatTime(currentSec)} / {formatTime(totalSec)}
        </Text>
      </View>

      {/* Controls row */}
      <View style={audioPreviewStyles.controlsRow}>
        {/* Play / Pause */}
        <TouchableOpacity
          style={[audioPreviewStyles.playBtn, { backgroundColor: c.primary }]}
          onPress={togglePlay}
          accessibilityLabel={playing ? (t('audio.stop') ?? 'Stop') : (t('audio.play') ?? 'Play')}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#fff" />
        </TouchableOpacity>

        {/* Status text */}
        <Text style={[audioPreviewStyles.statusText, { color: c.text }]}>
          {playing ? (t('audio.playing') ?? 'Playing…') : (t('audio.tapToPlay') ?? 'Tap to play')}
        </Text>

        {/* Delete */}
        <TouchableOpacity
          style={[audioPreviewStyles.deleteBtn, { backgroundColor: c.error + '15' }]}
          onPress={() => { playerRef.current?.remove(); playerRef.current = null; onDelete(); }}
          accessibilityLabel={t('audio.delete') ?? 'Delete recording'}
        >
          <Ionicons name="trash-outline" size={18} color={c.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const audioPreviewStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5,
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    gap: tokens.spacing3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 15, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  track: { flex: 1, height: 5, borderRadius: 3 },
  fill: { height: 5, borderRadius: 3 },
  time: { fontSize: 12, fontWeight: '500', minWidth: 38, textAlign: 'right' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3 },
  playBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  statusText: { flex: 1, fontSize: 13, fontWeight: '500' },
  deleteBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
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
      setPendingAudioUri(null);
      questionApi.getStats().then((res) => {
        const data = res.data as { remainingToday: number; maxQuestionChars?: number; maxImageSizeMb?: number };
        setRemainingToday(data.remainingToday);
        if (data.maxQuestionChars) setMaxChars(data.maxQuestionChars);
        if (data.maxImageSizeMb) setMaxImageSizeMb(data.maxImageSizeMb);
      });
    }
  }, [isFocused, isEditMode]);

  const [questionText, setQuestionText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [remainingToday, setRemainingToday] = useState(20);
  const [maxChars, setMaxChars] = useState(MAX_QUESTION_CHARS_FALLBACK);
  const [maxImageSizeMb, setMaxImageSizeMb] = useState(5);

  // ── Image attachment state ────────────────────────────────────────────────
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [compressedImageUri, setCompressedImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // ── Audio state ────────────────────────────────────────────────────────────
  // MicButton owns the AudioPreview UI; QuestionScreen keeps the URI so it
  // can be passed to QuestionPreview and used for mediaType detection.
  const [pendingAudioUri, setPendingAudioUri] = useState<string | null>(null);



  // ── On-device AI validation ───────────────────────────────────────────────
  const [aiValidation, setAiValidation] = useState<AIValidationResult | null>(null);
  const [aiValidationOverride, setAiValidationOverride] = useState(false);
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTextRef = useRef('');

  const scheduleValidation = useCallback(
    (text: string) => {
      if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
      if (!text.trim() || text === prevTextRef.current) return;
      prevTextRef.current = text;
      aiDebounceRef.current = setTimeout(async () => {
        const result = await runOnDeviceValidation({ text, ownId: editingQuestionId });
        setAiValidation(result);
        if (result.verdict !== 'warn') setAiValidationOverride(false);
      }, 600);
    },
    [editingQuestionId],
  );

  useEffect(() => {
    return () => { if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current); };
  }, []);

  // ── Image picker ─────────────────────────────────────────────────────────
  async function handleSelectImage() {
    setImageError(null);
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      selectionLimit: 1,
    });
    if (!result.assets || result.assets.length === 0) return;
    const asset = result.assets[0];
    const uri: string = asset.uri ?? '';
    if (!uri) return;

    const reportedSize = asset.fileSize;
    let sizeMb: number;
    if (reportedSize != null && reportedSize > 0) {
      sizeMb = reportedSize / 1024 / 1024;
    } else {
      sizeMb = await getImageSizeMB(uri);
    }
    if (sizeMb === 0) { setImageError('Could not read image file. Please try a different one.'); return; }
    if (sizeMb > maxImageSizeMb * 3) {
      setImageError(`Image is ${sizeMb.toFixed(1)} MB — will be compressed to ~${maxImageSizeMb} MB`);
    }

    setSelectedImageUri(uri);
    if (sizeMb > maxImageSizeMb) {
      try {
        const compressed = await compressImage(uri);
        setCompressedImageUri(compressed);
      } catch { setCompressedImageUri(null); }
    } else {
      setCompressedImageUri(null);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!questionText.trim()) errs.questionText = t('question.enterQuestion');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }



  // ── Submit-for-preview ─────────────────────────────────────────────────────
  async function handlePreview() {
    if (!validate()) return;
    if (questionText.trim().length > maxChars) {
      showToast(t('question.textTooLong', { max: maxChars }), 'warning'); return;
    }
    if (!isEditMode && remainingToday <= 0) {
      showToast(t('question.limitReached', { limit: 20 }), 'warning'); return;
    }

    const validation = await runOnDeviceValidation({ text: questionText.trim(), ownId: editingQuestionId });
    setAiValidation(validation);
    if (validation.verdict === 'fail') {
      showToast(t(validation.reasonKey ?? 'onDeviceAI.defaultFail') ?? t('onDeviceAI.defaultFail'), 'error');
      return;
    }
    if (validation.verdict === 'warn' && !aiValidationOverride) return;

    setPreviewLoading(true);
    try {
      const res = await questionApi.preview({
        questionText: questionText.trim(),
        mediaType: 'none',
        mediaUrls: [],
      });

      const hasAudio = Boolean(pendingAudioUri);
      const hasImage = Boolean(selectedImageUri);
      let mediaType: 'none' | 'image' | 'audio' = 'none';
      if (hasAudio) mediaType = 'audio';
      else if (hasImage) mediaType = 'image';

      (navigation as any).navigate('QuestionPreview', {
        state: res.data.state ?? user?.state ?? '',
        district: res.data.district ?? user?.district ?? '',
        block: res.data.block ?? user?.block ?? null,
        domains: res.data.domains ?? [],
        season: res.data.season ?? '',
        cropType: res.data.cropType ?? '',
        questionText: questionText.trim(),
        mediaType,
        mediaUrls: [],
        pendingImageUri: selectedImageUri,
        pendingImageCompressed: compressedImageUri !== null,
        pendingAudioUri,
        agroClimaticZone: res.data.agroClimaticZone ?? 'other',
        suggestedDistricts: res.data.suggestedDistricts ?? [],
        suggestedBlocks: res.data.suggestedBlocks ?? [],
        remainingToday: res.data.remainingToday ?? remainingToday,
        dailyLimit: res.data.dailyLimit ?? 20,
      } as RootStackParamList['QuestionPreview']);
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, t('question.submitFailed')), 'error');
    } finally {
      setPreviewLoading(false);
    }
  }

  const charCountColor =
    questionText.length > maxChars ? c.error
      : questionText.length > maxChars * 0.9 ? '#E88B00'
      : c.textSecondary;

  const relevanceFailed = (aiValidation?.verdict === 'fail' && aiValidation?.reasonKey === 'onDeviceAI.relevance.low');
  const canSubmit = questionText.trim().length > 0 && questionText.length <= maxChars && (isEditMode || remainingToday > 0) && !relevanceFailed;

  // ─── Render ──────────────────────────────────────────────────────────────────

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: c.text }]}>
                {isEditMode ? t('question.editQuestion') : t('question.askQuestion')}
              </Text>
              <TooltipIcon description={isEditMode ? t('question.tooltipEdit') : t('question.tooltipAsk')} size={18} />
            </View>
            {!isEditMode && (
              <View style={styles.limitRow}>
                <View style={[styles.limitDot, { backgroundColor: c.primary }]} />
                <Text style={[styles.limitText, { color: c.textSecondary }]}>
                  {remainingToday} submissions remaining today
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

          {/* Card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
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
                onChangeText={(v) => { setQuestionText(v); setErrors({}); scheduleValidation(v); }}
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

            {questionText.length > maxChars && (
              <Text style={[styles.overLimitText, { color: c.error }]}>
                {t('question.textTooLong', { max: maxChars })}
              </Text>
            )}

            {/* ── Image attachment ─────────────────────────────────────────── */}
            <View style={styles.imageSection}>
              <Text style={[styles.imageSectionLabel, { color: c.textSecondary }]}>
                Attach an image (optional)
              </Text>
              {selectedImageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image source={{ uri: compressedImageUri ?? selectedImageUri }} style={styles.attachedImage} resizeMode="cover" />
                  <ImgTouchableOpacity
                    style={[styles.removeImageBtn, { backgroundColor: c.error }]}
                    onPress={() => { setSelectedImageUri(null); setCompressedImageUri(null); setImageError(null); }}
                    accessibilityLabel="Remove image"
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </ImgTouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.attachImageBtn, { borderColor: c.borderSubtle }]}
                  onPress={handleSelectImage}
                  accessibilityLabel="Attach image from gallery"
                >
                  <Ionicons name="image-outline" size={22} color={c.textSecondary} />
                  <Text style={[styles.attachImageBtnText, { color: c.textSecondary }]}>Add image</Text>
                </TouchableOpacity>
              )}
              {imageError && <Text style={[styles.imageErrorText, { color: c.error }]}>{imageError}</Text>}
            </View>

            {/* AI warning banner */}
            <AIValidationBanner
              result={aiValidation ?? { verdict: 'pass', message: null, reasonKey: null, stages: { relevance: { pass: true, confidence: 1 }, duplicate: { pass: true, confidence: 1 }, spam: { pass: true, confidence: 1 } }, ran: false }}
              onOverride={() => { setAiValidationOverride(true); handlePreview(); }}
              onDismiss={() => { setAiValidation(null); setAiValidationOverride(false); }}
            />

            {/* Submit button */}
            {!isEditMode ? (
              <Button
                title={previewLoading ? t('question.submitting') : relevanceFailed ? (t('question.notRelevant') ?? 'Not Relevant') : t('continue')}
                onPress={handlePreview}
                loading={previewLoading}
                disabled={!canSubmit || relevanceFailed}
                icon="arrow-forward"
                iconPosition="right"
              />
            ) : (
              <Button
                title={loading ? t('question.updating') : t('question.updateQuestion')}
                onPress={async () => {
                  if (!questionText.trim()) { setErrors({ questionText: t('question.enterQuestion') }); return; }
                  setLoading(true);
                  try {
                    await questionApi.update(editingQuestionId!, { questionText: questionText.trim(), mediaType: 'none', mediaUrls: [] });
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

            <Text style={[styles.reviewHint, { color: c.textSecondary }]}>
              {t('question.reviewHint') ?? 'Questions are mostly reviewed within 24 hours'}
            </Text>
          </View>
        </ScrollView>

        {/* ── Mic dock — pinned to bottom ─────────────────────────────────── */}
        <View style={[styles.micDock, { backgroundColor: c.background }]}>
          <View style={[styles.micDockDivider, { backgroundColor: c.borderSubtle }]} />
          <View style={styles.micInstructionCenter}>
            {remainingToday <= 0 && !isEditMode ? (
              <Text style={[styles.micHintText, { color: c.textTertiary }]}>
                {t('question.dailyLimitReached', { total: 20 })}
              </Text>
            ) : (
              <Text style={[styles.micHintText, { color: c.textSecondary }]}>
                {t('question.tapMicHint') ?? 'Tap the mic to speak your question'}
              </Text>
            )}
          </View>
          <View style={styles.micButtonCenter}>
            <MicButton
              onTranscribed={(text) => {
                setQuestionText(text);
                setErrors({});
                scheduleValidation(text);
              }}
              onRecordingDeleted={() => {
                setPendingAudioUri(null);
                setQuestionText('');
                setErrors({});
                setAiValidation(null);
                setAiValidationOverride(false);
              }}
              onRecordingComplete={(uri) => {
                setPendingAudioUri(uri);
              }}
              disabled={remainingToday <= 0 && !isEditMode}
            />
          </View>

          {/* ── AudioPreview dock — full-width card below the mic button ── */}
          {pendingAudioUri && (
            <View style={styles.audioPreviewDock}>
              <AudioPreview
                uri={pendingAudioUri}
                onDelete={() => {
                  setPendingAudioUri(null);
                  setQuestionText('');
                  setErrors({});
                  setAiValidation(null);
                  setAiValidationOverride(false);
                }}
              />
            </View>
          )}
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
  scroll: { flexGrow: 1, padding: tokens.spacing6, paddingBottom: tokens.spacing4 },

  header: { marginBottom: tokens.spacing5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginTop: tokens.spacing2 },
  limitDot: { width: 7, height: 7, borderRadius: 4 },
  limitText: { fontSize: 13 },

  editBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusMd, gap: tokens.spacing2, marginBottom: tokens.spacing4,
  },
  editBannerText: { fontSize: 13, fontWeight: '500', flex: 1 },

  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing5 },
  cardHeading: { fontSize: 16, fontWeight: '700', marginBottom: tokens.spacing4 },

  inputWrap: { marginBottom: tokens.spacing2 },
  textArea: {
    height: 160, textAlignVertical: 'top',
    paddingTop: tokens.spacing4, paddingHorizontal: tokens.spacing3,
    fontSize: 16, lineHeight: 24,
  },

  charRow: { marginBottom: tokens.spacing3 },
  charCount: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  hintTipRow: { flexDirection: 'row', alignItems: 'center' },
  hintText: { fontSize: 12, fontWeight: '500', flex: 1 },
  overLimitText: { fontSize: 12, fontWeight: '600', marginBottom: tokens.spacing2 },

  reviewHint: {
    fontSize: 12, textAlign: 'center',
    lineHeight: 17, marginTop: tokens.spacing3,
  },

  micDock: {
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing3, paddingBottom: tokens.spacing4,
  },
  micDockDivider: { height: 1, width: '100%', marginBottom: tokens.spacing3 },
  micInstructionCenter: { marginBottom: tokens.spacing3 },
  micButtonCenter: { alignItems: 'center' },
  micHintText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  audioPreviewDock: {
    marginTop: tokens.spacing3,
    width: '100%',
  },

  imageSection: {
    marginTop: tokens.spacing3, paddingTop: tokens.spacing3,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  imageSectionLabel: { fontSize: 13, fontWeight: '500', marginBottom: tokens.spacing2 },
  attachImageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2,
    borderWidth: 1.5, borderRadius: tokens.radiusMd, borderStyle: 'dashed',
    paddingVertical: tokens.spacing2, paddingHorizontal: tokens.spacing3,
  },
  attachImageBtnText: { fontSize: 14, fontWeight: '500' },
  imagePreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  attachedImage: {
    width: 100, height: 100, borderRadius: tokens.radiusMd, backgroundColor: '#f0f0f0',
  },
  removeImageBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  imageErrorText: { fontSize: 12, marginTop: tokens.spacing1 },
});