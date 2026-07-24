import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  AudioModule,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { speechApi, toSarvamLang } from '../../api/speech';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { tokens } from '../../utils/theme';
import { useToast } from '../../components/Toast';

type RecorderState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

// Supported language options for the STT language picker
const STT_LANGUAGES = [
  { code: 'unknown', label: 'Auto-detect' },
  { code: 'hi-IN',   label: 'Hindi' },
  { code: 'en-IN',   label: 'English' },
  { code: 'bn-IN',   label: 'Bengali' },
  { code: 'ta-IN',   label: 'Tamil' },
  { code: 'te-IN',   label: 'Telugu' },
  { code: 'mr-IN',   label: 'Marathi' },
  { code: 'gu-IN',   label: 'Gujarati' },
  { code: 'kn-IN',   label: 'Kannada' },
  { code: 'ml-IN',   label: 'Malayalam' },
  { code: 'pa-IN',   label: 'Punjabi' },
];

export function SpeechToTextScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const { language: appLanguage } = useLanguage();

  // ── Recording state ────────────────────────────────────────────────────────
  const [state, setState] = useState<RecorderState>('idle');
  const [transcript, setTranscript] = useState('');
  const [recordingMsec, setRecordingMsec] = useState(0);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // The language the user selects for STT (Sarvam language code)
  const [selectedLang, setSelectedLang] = useState<string>(
    toSarvamLang(appLanguage),
  );

  // Deferred callback refs (stable across renders)
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;

  // Recorder refs
  const recorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const liveDurationMsRef = useRef(0);

  // ── Pulse animation ────────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(tickerRef.current!);
      recorderRef.current?.stop().catch(() => {});
    };
  }, []);

  // ── Upload audio after recording stops ─────────────────────────────────────
  async function uploadAndTranscribe(uri: string, _durationMs: number) {
    setState('uploading');
    try {
      const langCode = selectedLang === 'unknown' ? 'unknown' : selectedLang;
      const result = await speechApi.speechToText(uri, langCode);
      setTranscript(result.text);
      setState('done');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string }; status?: number }; message?: string })?.response?.data?.message
        ?? (err as Error)?.message
        ?? '';
      if (msg.includes('too short')) {
        showToast(t('speech.stt.errorTooShort'), 'error');
      } else {
        showToast(t('speech.stt.errorFailed'), 'error');
      }
      setState('error');
      // Return to idle after a short delay so user can retry
      setTimeout(() => setState('idle'), 2000);
    }
  }

  // ── Start recording ────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showToast(t('speech.stt.errorPermission'), 'error');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const recorder = new AudioModule.AudioRecorder({
        extension: Platform.OS === 'ios' ? '.m4a' : '.mp4',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128_000,
        ios: {
          outputFormat: IOSOutputFormat.MPEG4AAC,
          audioQuality: AudioQuality.MAX,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        android: { outputFormat: 'aac' as any, audioEncoder: 'aac' },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128_000 },
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      recorderRef.current = recorder;
      startTimeRef.current = Date.now();
      liveDurationMsRef.current = 0;
      setRecordingMsec(0);
      setTranscript('');
      setState('recording');
      startPulse();

      // Tick elapsed time
      tickerRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          liveDurationMsRef.current = Date.now() - startTimeRef.current;
          setRecordingMsec(liveDurationMsRef.current);
        }
      }, 250);

      // No auto-stop — user controls recording duration
    } catch (err) {
      console.error('[SpeechToText] startRecording error:', err);
      showToast(t('audio.startError'), 'error');
    }
  }

  // ── Stop recording ─────────────────────────────────────────────────────────
  async function stopRecording() {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    startTimeRef.current = null;

    stopPulse();

    const recorder = recorderRef.current;
    if (!recorder) return;

    setState('uploading');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = liveDurationMsRef.current;
      recorderRef.current = null;

      if (!uri) {
        showToast(t('speech.stt.errorFailed'), 'error');
        setState('idle');
        return;
      }

      await uploadAndTranscribe(uri, durationMs);
    } catch (err) {
      console.error('[SpeechToText] stopRecording error:', err);
      showToast(t('speech.stt.errorFailed'), 'error');
      setState('idle');
    }
  }

  function handleMicPress() {
    if (state === 'idle' || state === 'done' || state === 'error') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  async function handleShare() {
    if (!transcript.trim()) return;
    try {
      await Share.share({ message: transcript });
    } catch {
      showToast(t('speech.stt.copy'), 'warning');
    }
  }

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const isProcessing = isRecording || isUploading;

  const selectedLangLabel =
    STT_LANGUAGES.find((l) => l.code === selectedLang)?.label ?? 'Auto-detect';

  function fmtMsec(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t('speech.stt.title')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Language picker ──────────────────────────────────────────── */}
        <View style={styles.langSection}>
          <Text style={[styles.langLabel, { color: theme.colors.textSecondary }]}>
            {t('speech.stt.language')}
          </Text>
          <TouchableOpacity
            style={[
              styles.langChip,
              { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.borderSubtle },
            ]}
            onPress={() => setShowLangPicker((v) => !v)}
            disabled={isProcessing}
          >
            <Text style={[styles.langChipText, { color: theme.colors.text }]}>
              {selectedLangLabel}
            </Text>
            <Ionicons
              name={showLangPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
          <Text style={[styles.langHint, { color: theme.colors.textTertiary }]}>
            {t('speech.stt.languageHint')}
          </Text>

          {showLangPicker && (
            <View style={[styles.langPicker, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle }]}>
              {STT_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    selectedLang === lang.code && {
                      backgroundColor: theme.colors.primary + '18',
                    },
                  ]}
                  onPress={() => {
                    setSelectedLang(lang.code);
                    setShowLangPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      { color: selectedLang === lang.code ? theme.colors.primary : theme.colors.text },
                    ]}
                  >
                    {lang.label}
                  </Text>
                  {selectedLang === lang.code && (
                    <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Result card ──────────────────────────────────────────────── */}
        <View
          style={[
            styles.resultCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSubtle },
          ]}
        >
          <View style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
              {t('speech.stt.result')}
            </Text>
            {transcript.trim().length > 0 && (
              <TouchableOpacity onPress={handleShare} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.copyBtn, { color: theme.colors.primary }]}>
                  {t('speech.stt.copy')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Show placeholder when idle/no transcript */}
          {isProcessing || (!transcript.trim() && state !== 'done') ? (
            <View style={styles.placeholderWrap}>
              {isUploading && (
                <View style={styles.uploadingRow}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={[styles.uploadingText, { color: theme.colors.textSecondary }]}>
                    Transcribing…
                  </Text>
                </View>
              )}
              {!isUploading && (
                <Text style={[styles.placeholder, { color: theme.colors.textTertiary }]}>
                  Your transcribed text will appear here
                </Text>
              )}
            </View>
          ) : (
            <Text style={[styles.transcriptText, { color: theme.colors.text }]}>
              {transcript}
            </Text>
          )}
        </View>

        {/* ── Error hint ──────────────────────────────────────────────── */}
        {(state === 'error' || state === 'done') && !transcript.trim() && !isProcessing && (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {state === 'error' ? t('speech.stt.errorFailed') : ''}
          </Text>
        )}
      </ScrollView>

      {/* ── Bottom mic button ─────────────────────────────────────────── */}
      <View style={[styles.bottomDock, { borderTopColor: theme.colors.borderSubtle }]}>
        {/* Duration badge */}
        {isRecording && (
          <View style={[styles.durationBadge, { backgroundColor: theme.colors.error + '15' }]}>
            <View style={[styles.recordingDot, { backgroundColor: theme.colors.error }]} />
            <Text style={[styles.durationText, { color: theme.colors.error }]}>
              {fmtMsec(recordingMsec)} / 0:55
            </Text>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
          <TouchableOpacity
            style={[
              styles.micBtn,
              {
                backgroundColor: isProcessing
                  ? theme.colors.muted
                  : isRecording
                  ? theme.colors.error
                  : theme.colors.primary,
              },
            ]}
            onPress={handleMicPress}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            {isUploading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={36}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        </Animated.View>

        <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
          {isUploading
            ? t('speech.stt.uploading')
            : isRecording
            ? t('speech.stt.stopRecording')
            : t('speech.stt.startRecording')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: tokens.spacing6,
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing6,
    gap: tokens.spacing5,
  },

  // Language picker
  langSection: { gap: tokens.spacing2 },
  langLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: tokens.spacing2,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing2 + 2,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    gap: tokens.spacing2,
  },
  langChipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  langHint: {
    fontSize: 12,
    marginTop: tokens.spacing1,
  },
  langPicker: {
    borderWidth: 1,
    borderRadius: tokens.radiusLg,
    marginTop: tokens.spacing2,
    overflow: 'hidden',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
  },
  langOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Result card
  resultCard: {
    borderRadius: tokens.radiusXl,
    borderWidth: 1,
    padding: tokens.spacing5,
    minHeight: 160,
    gap: tokens.spacing4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  copyBtn: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing3,
  },
  placeholder: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing3,
  },
  uploadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Bottom dock
  bottomDock: {
    alignItems: 'center',
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing6,
    borderTopWidth: 1,
    gap: tokens.spacing3,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing2,
    borderRadius: tokens.radiusFull,
    gap: tokens.spacing2,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '700',
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  hintText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});