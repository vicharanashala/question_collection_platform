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
  /** Called when recording stops — provides the file URI and duration (ms) for playback preview. */
  onRecordingComplete?: (uri: string, durationMs: number) => void;
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
  const [recordingMsec, setRecordingMsec] = useState(0);
  const [transcriptSoFar, setTranscriptSoFar] = useState('');

  // Deferred callbacks
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const onTranscribedRef = useRef(onTranscribed);
  const onRecordingStartRef = useRef(onRecordingStart);
  onRecordingCompleteRef.current = onRecordingComplete;
  onTranscribedRef.current = onTranscribed;
  onRecordingStartRef.current = onRecordingStart;

  // Full audio recorder — runs continuously for playback
  const fullRecorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  // Chunk recorder — stop/start every 5s for real-time transcription
  const chunkRecorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);

  // Auto-stop timer
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Chunk interval timer
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Elapsed time ticker
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Whether a stop is in progress
  const stoppingRef = useRef(false);
  // Recording start timestamp (ms)
  const startTimeRef = useRef<number | null>(null);
  // Live recording elapsed (ms)
  const liveDurationMsRef = useRef(0);
  // Chunk sequence number
  const sequenceRef = useRef(0);

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

  // ── Upload a transcription chunk ─────────────────────────────────────────
  async function uploadChunk(uri: string, seq: number) {
    try {
      const formData = new (globalThis.FormData)();
      formData.append('audio', { uri, name: `chunk-${seq}.aac`, type: 'audio/aac' } as unknown as string);
      formData.append('languageCode', toSarvamLang(languageCode));
      formData.append('sequenceNumber', String(seq));

      const { data } = await api.post<ChunkResult>(
        '/speech/transcribe-chunk',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      if (data.text) {
        setTranscriptSoFar((prev) => {
          const next = prev ? `${prev} ${data.text}` : data.text;
          setTimeout(() => onTranscribedRef.current?.(next), 0);
          return next;
        });
      }
    } catch (err) {
      console.warn(`[AudioRecorder] chunk ${seq} upload failed:`, err);
    }
  }

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      if (tickerRef.current) clearInterval(tickerRef.current);
      fullRecorderRef.current?.stop().catch(() => {});
      chunkRecorderRef.current?.stop().catch(() => {});
    };
  }, []);

  // ── Start recording ──────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showToast(t('audio.permissionDenied') ?? 'Microphone permission required', 'error');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      const makeRecorder = () =>
        new AudioModule.AudioRecorder({
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
          android: { outputFormat: 'aac', audioEncoder: 'aac' },
          web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
        });

      // Start both recorders
      const fullRecorder = makeRecorder();
      const chunkRecorder = makeRecorder();

      await fullRecorder.prepareToRecordAsync();
      await chunkRecorder.prepareToRecordAsync();

      fullRecorder.record();
      chunkRecorder.record();

      fullRecorderRef.current = fullRecorder;
      chunkRecorderRef.current = chunkRecorder;
      stoppingRef.current = false;
      sequenceRef.current = 0;
      setTranscriptSoFar('');
      setRecordingMsec(0);
      liveDurationMsRef.current = 0;
      startTimeRef.current = Date.now();

      setState('recording');
      startPulseAnimation();

      // Elapsed time ticker
      tickerRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          const elapsed = Date.now() - startTimeRef.current;
          liveDurationMsRef.current = elapsed;
          setRecordingMsec(elapsed);
        }
      }, 250);

      setTimeout(() => onRecordingStartRef.current?.(), 0);

      // Auto-stop at max duration
      autoStopRef.current = setTimeout(() => stopRecording(), MAX_RECORDING_SECONDS * 1000);

      // Chunk interval: stop the chunk recorder, upload, restart
      chunkTimerRef.current = setInterval(async () => {
        const chunk = chunkRecorderRef.current;
        if (!chunk || stoppingRef.current) return;
        try {
          await chunk.stop();
          const uri = chunk.uri;
          if (uri) {
            const seq = sequenceRef.current++;
            uploadChunk(uri, seq);
          }
          // Restart chunk recorder for next interval
          await chunk.prepareToRecordAsync();
          chunk.record();
        } catch (err) {
          console.warn('[AudioRecorder] chunk cut failed:', err);
        }
      }, CHUNK_INTERVAL_MS);
    } catch (err) {
      console.error('[AudioRecorder] startRecording error:', err);
      showToast(t('audio.startError') ?? 'Failed to start recording', 'error');
    }
  }

  // ── Stop recording ───────────────────────────────────────────────────────
  async function stopRecording() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    stopPulseAnimation();

    const fullRecorder = fullRecorderRef.current;
    const chunkRecorder = chunkRecorderRef.current;

    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
    chunkTimerRef.current = null;
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    startTimeRef.current = null;

    setState('uploading');

    try {
      // Stop full recorder → URI = complete audio for playback
      if (fullRecorder) {
        await fullRecorder.stop();
        const fullUri = fullRecorder.uri;
        const durationMs = liveDurationMsRef.current;
        if (fullUri) {
          setTimeout(() => {
            onRecordingCompleteRef.current?.(fullUri, durationMs);
          }, 0);
        }
      }

      // Stop chunk recorder → upload final chunk
      if (chunkRecorder) {
        await chunkRecorder.stop();
        const chunkUri = chunkRecorder.uri;
        if (chunkUri) {
          const seq = sequenceRef.current++;
          const formData = new (globalThis.FormData)();
          formData.append('audio', { uri: chunkUri, name: `final-${seq}.aac`, type: 'audio/aac' } as unknown as string);
          formData.append('languageCode', toSarvamLang(languageCode));
          formData.append('sequenceNumber', String(seq));

          const { data } = await api.post<{ text: string; error?: string }>(
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
      }

      setState('done');
      setRecordingMsec(0);
      setTimeout(() => setState('idle'), 2000);
    } catch (err: unknown) {
      console.error('[AudioRecorder] stopRecording error:', err);
      showToast(
        (err as Error)?.message ?? t('audio.transcribeError') ?? 'Transcription failed. Please try again.',
        'error',
      );
      setRecordingMsec(0);
      setState('idle');
    } finally {
      fullRecorderRef.current = null;
      chunkRecorderRef.current = null;
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
      <Animated.View
        style={[styles.pulseWrap, { transform: [{ scale: isRecording ? pulseAnim : 1 }] }]}
      >
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingOuter,
              {
                borderColor: c.primary + '30',
                opacity: pulseAnim.interpolate({ inputRange: [1, 1.12], outputRange: [0.6, 0] }),
              },
            ]}
          />
        )}

        <TouchableOpacity
          style={[
            styles.voiceBtn,
            {
              backgroundColor: isDisabled ? c.muted : isRecording ? c.error : c.primary,
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
              <Ionicons name={isRecording ? 'stop' : 'mic'} size={28} color="#fff" />
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