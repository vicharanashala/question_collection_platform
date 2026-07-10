import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {
  AudioModule,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

const CHUNK_INTERVAL_MS = 5_000;
const MAX_RECORDING_SECONDS = 60;

type RecorderState = 'idle' | 'recording' | 'uploading' | 'done';

interface AudioRecorderProps {
  /** Called with the transcribed text as it arrives (appended progressively). */
  onTranscribed: (text: string) => void;
  /** Called when recording stops — provides the file URI for playback preview. */
  onRecordingComplete?: (uri: string) => void;
  /** Called when a new recording starts — use to clear any prior playback. */
  onRecordingStart?: () => void;
  /** Show a label below the button */
  label?: string;
  /** Disable the recorder */
  disabled?: boolean;
}

interface ChunkResult {
  sequenceNumber: number;
  text: string;
  error: string | null;
}

interface PendingChunk {
  sequenceNumber: number;
  resolve: (text: string) => void;
  reject: (err: Error) => void;
}

export function AudioRecorder({
  onTranscribed,
  onRecordingComplete,
  onRecordingStart,
  label,
  disabled,
}: AudioRecorderProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [state, setState] = useState<RecorderState>('idle');
  const [transcriptSoFar, setTranscriptSoFar] = useState('');
  const [recordingMsec, setRecordingMsec] = useState(0);

  // Deferred callbacks — stored in refs so they survive re-renders without
  // triggering state in the parent during the current render pass.
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const onTranscribedRef = useRef(onTranscribed);
  const onRecordingStartRef = useRef(onRecordingStart);
  onRecordingCompleteRef.current = onRecordingComplete;
  onTranscribedRef.current = onTranscribed;
  onRecordingStartRef.current = onRecordingStart;

  // Active recorder instance
  const recorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  // 5-second chunk timer
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Auto-stop timer
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending chunk uploads (promise resolvers)
  const pendingChunksRef = useRef<PendingChunk[]>([]);
  // Sequence number counter
  const sequenceRef = useRef(0);
  // Whether a stop is in progress (prevents new chunks)
  const stoppingRef = useRef(false);
  // Elapsed time ticker
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Recording start timestamp (ms)
  const startTimeRef = useRef<number | null>(null);

  // ── Pulse scale animation ────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulseAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulseAnimation = useCallback(() => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim]);

  const languageCode = language;

  // ── Language code → Sarvam locale ────────────────────────────────────────
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

  // ── Upload a single chunk and resolve the pending promise ─────────────────
  const uploadChunk = useCallback(
    async (uri: string, seq: number) => {
      try {
        const formData = new (globalThis.FormData)();
        formData.append('audio', {
          uri,
          name: `chunk-${seq}.aac`,
          type: 'audio/aac',
        } as unknown as string);
        formData.append('languageCode', toSarvamLang(languageCode));
        formData.append('sequenceNumber', String(seq));

        const { data } = await api.post<ChunkResult>(
          '/speech/transcribe-chunk',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );

        const pending = pendingChunksRef.current.find((p) => p.sequenceNumber === seq);
        if (pending) {
          pending.resolve(data.text ?? '');
          pendingChunksRef.current = pendingChunksRef.current.filter(
            (p) => p.sequenceNumber !== seq,
          );
        }

        if (data.text) {
          setTranscriptSoFar((prev) => {
            const next = prev ? `${prev} ${data.text}` : data.text;
            // Defer callback to avoid setState-in-render
            setTimeout(() => onTranscribedRef.current?.(next), 0);
            return next;
          });
        }
      } catch (err) {
        console.warn(`[AudioRecorder] chunk ${seq} failed:`, err);
        const pending = pendingChunksRef.current.find((p) => p.sequenceNumber === seq);
        if (pending) {
          pending.reject(err as Error);
          pendingChunksRef.current = pendingChunksRef.current.filter(
            (p) => p.sequenceNumber !== seq,
          );
        }
      }
    },
    [languageCode],
  );

  // ── Stop current chunk, upload it, start a new recording ─────────────────
  const cutChunkAndRestart = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || stoppingRef.current) return;

    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      try { recorder.record(); } catch { /* ignore */ }
      return;
    }

    const seq = sequenceRef.current++;
    pendingChunksRef.current.push({
      sequenceNumber: seq,
      resolve: () => {},
      reject: () => {},
    });
    uploadChunk(uri, seq);

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.error('[AudioRecorder] failed to restart after chunk:', err);
    }
  }, [uploadChunk]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ── Start continuous recording ───────────────────────────────────────────
  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showToast(
          t('audio.permissionDenied') ?? 'Microphone permission required',
          'error',
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      const recorder = new AudioModule.AudioRecorder({
        extension: '.aac',
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
        ios: {
          outputFormat: IOSOutputFormat.MPEG4AAC,
          audioQuality: AudioQuality.MAX,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        android: {
          outputFormat: 'aac',
          audioEncoder: 'aac',
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      recorderRef.current = recorder;
      stoppingRef.current = false;
      sequenceRef.current = 0;
      pendingChunksRef.current = [];
      setTranscriptSoFar('');
      setState('recording');
      setRecordingMsec(0);
      startTimeRef.current = Date.now();
      if (tickerRef.current) clearInterval(tickerRef.current);
      startPulseAnimation();
      tickerRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          setRecordingMsec(Date.now() - startTimeRef.current);
        }
      }, 250);
      setTimeout(() => onRecordingStartRef.current?.(), 0);

      chunkTimerRef.current = setInterval(() => {
        cutChunkAndRestart();
      }, CHUNK_INTERVAL_MS);

      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
    } catch (err) {
      console.error('[AudioRecorder] startRecording error:', err);
      showToast(
        t('audio.startError') ?? 'Failed to start recording',
        'error',
      );
    }
  }

  // ── Stop recording ───────────────────────────────────────────────────────
  async function stopRecording() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    stopPulseAnimation();

    const recorder = recorderRef.current;
    if (!recorder) return;

    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
    chunkTimerRef.current = null;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;

    startTimeRef.current = null;
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }

    setState('uploading');

    try {
      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        // Defer the callback so this setState settles before the parent updates
        setTimeout(() => {
          onRecordingCompleteRef.current?.(uri);
        }, 0);

        const seq = sequenceRef.current++;
        const formData = new (globalThis.FormData)();
        formData.append('audio', {
          uri,
          name: `final-${seq}.aac`,
          type: 'audio/aac',
        } as unknown as string);
        formData.append('languageCode', toSarvamLang(languageCode));
        formData.append('sequenceNumber', String(seq));

        const { data } = await api.post<ChunkResult>(
          '/speech/transcribe-final',
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );

        if (data.text) {
          setTranscriptSoFar((prev) => {
            const next = prev ? `${prev} ${data.text}` : data.text;
            setTimeout(() => onTranscribedRef.current?.(next), 0);
            return next;
          });
        } else if (data.error) {
          showToast(t('audio.transcribeError') ?? 'Transcription failed', 'error');
        }
      }

      setState('done');
      startTimeRef.current = null;
      setRecordingMsec(0);
      setTimeout(() => setState('idle'), 2000);
    } catch (err: unknown) {
      console.error('[AudioRecorder] stopRecording error:', err);
      showToast(
        (err as Error)?.message ??
          t('audio.transcribeError') ??
          'Transcription failed. Please try again.',
        'error',
      );
      startTimeRef.current = null;
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
      setRecordingMsec(0);
      setState('idle');
    } finally {
      recorderRef.current = null;
      pendingChunksRef.current = [];
    }
  }

  function handlePress() {
    if (disabled) return;
    if (state === 'idle' || state === 'done') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const isDisabled = disabled || isUploading;

  return (
    <View style={styles.container}>
      {/* Pulse + button */}
      <Animated.View
        style={[
          styles.pulseWrap,
          { transform: [{ scale: isRecording ? pulseAnim : 1 }] },
        ]}
      >
        {/* Outer pulse ring — animates when recording */}
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingOuter,
              {
                borderColor: c.primary + '30',
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.12],
                  outputRange: [0.6, 0],
                }),
              },
            ]}
          />
        )}

        <TouchableOpacity
          style={[
            styles.voiceBtn,
            {
              backgroundColor: isDisabled
                ? c.muted
                : isRecording
                ? c.error
                : c.primary,
            },
          ]}
          onPress={handlePress}
          disabled={isDisabled}
          activeOpacity={0.8}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isRecording ? 'stop' : 'mic'}
                size={28}
                color="#fff"
              />
              {/* Elapsed duration badge */}
              {isRecording && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>
                    {Math.floor(recordingMsec / 60000)}:{String(Math.floor((recordingMsec % 60000) / 1000)).padStart(2, '0')}
                  </Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Label — only shown when not recording */}
      {!isRecording && label !== '' && (
        <Text style={[styles.label, { color: c.textSecondary }]}>
          {isUploading
            ? t('audio.transcribing') ?? 'Transcribing…'
            : label ?? t('audio.record') ?? 'Tap to record'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  pulseWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  pulseRingOuter: {
    width: 96,
    height: 96,
  },
  voiceBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1,
  },
  durationBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    marginTop: tokens.spacing2,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});