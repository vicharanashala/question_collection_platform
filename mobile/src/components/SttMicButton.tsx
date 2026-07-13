import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import {
  AudioModule,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { speechApi } from '../api/speech';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';
import { useToast } from './Toast';

type MicState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

interface SttMicButtonProps {
  /** Called with the transcribed text when recording completes and transcription succeeds. */
  onTranscribed: (text: string) => void;
  /** Called when a new recording starts — use to clear any prior state. */
  onRecordingStart?: () => void;
  /** Called immediately when recording stops, with the audio URI and duration in ms — before upload/transcription starts. */
  onRecordingComplete?: (uri: string, durationMs: number) => void;
  /** Disable the button */
  disabled?: boolean;
}

/**
 * One-shot STT mic button for the Question screen.
 *
 * Tap → records audio (max 55 s) → stops → uploads → fills textarea via `onTranscribed`.
 * No audio playback, no chunking — a single upload round-trip.
 */
export function SttMicButton({ onTranscribed, onRecordingStart, onRecordingComplete, disabled }: SttMicButtonProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  useLanguage(); // language preference not used — Sarvam auto-detects spoken language

  const [state, setState] = useState<MicState>('idle');
  const [recordingMsec, setRecordingMsec] = useState(0);
  const isFinal = state === 'done' || state === 'error';

  const onTranscribedRef = useRef(onTranscribed);
  const onRecordingStartRef = useRef(onRecordingStart);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  onTranscribedRef.current = onTranscribed;
  onRecordingStartRef.current = onRecordingStart;
  onRecordingCompleteRef.current = onRecordingComplete;

  const recorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.14,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);
  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [pulseAnim]);

  // Cleanup
  useEffect(() => {
    return () => {
      clearTimeout(autoStopRef.current!);
      clearInterval(tickerRef.current!);
      recorderRef.current?.stop().catch(() => {});
    };
  }, []);

  // ── Upload + transcribe ──────────────────────────────────────────────────
  async function uploadAndTranscribe(uri: string) {
    setState('uploading');
    try {
      // Pass 'unknown' so Sarvam auto-detects the spoken language from the audio.
      // Using the app's configured language (e.g. 'en-IN') would force English output
      // even when the user speaks in a regional language.
      const langCode = 'unknown';
      const result = await speechApi.speechToText(uri, langCode);
      setState('done');
      onTranscribedRef.current?.(result.text);
      setTimeout(() => setState('idle'), 2500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (msg.includes('too short')) {
        showToast(t('question.audio.micButtonDone', 'Audio too short — please record a longer message'), 'warning');
      } else if (msg.includes('60-second') || msg.includes('exceed')) {
        showToast(t('question.audio.micButtonDone', 'Audio too long — please record under 60 seconds'), 'warning');
      } else {
        showToast(t('question.audio.transcribeError', 'Transcription failed'), 'error');
      }
      setState('error');
      setTimeout(() => setState('idle'), 2500);
    }
  }

  // ── Start ───────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showToast(t('question.audio.permissionDenied'), 'error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

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

      setRecordingMsec(0);
      setState('recording');
      startPulse();

      tickerRef.current = setInterval(() => {
        if (startTimeRef.current !== null) {
          setRecordingMsec(Date.now() - startTimeRef.current);
        }
      }, 250);

      onRecordingStartRef.current?.();

      // No auto-stop — user controls record duration
    } catch (err) {
      console.error('[SttMicButton] startRecording error:', err);
      showToast(t('question.audio.startError'), 'error');
      setState('idle');
    }
  }

  // ── Stop ────────────────────────────────────────────────────────────────
  async function stopRecording() {
    clearTimeout(autoStopRef.current!);
    clearInterval(tickerRef.current!);
    autoStopRef.current = null;
    tickerRef.current = null;
    startTimeRef.current = null;
    stopPulse();

    const recorder = recorderRef.current;
    if (!recorder) return;

    setState('uploading');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      recorderRef.current = null;

      if (!uri) {
        showToast(t('question.audio.startError'), 'error');
        setState('idle');
        return;
      }

      onRecordingCompleteRef.current?.(`${uri}?dur=${recordingMsec}`, recordingMsec);
      await uploadAndTranscribe(uri);
    } catch (err) {
      console.error('[SttMicButton] stopRecording error:', err);
      showToast(t('question.audio.startError'), 'error');
      setState('idle');
    }
  }

  function handlePress() {
    if (disabled) return;
    if (state === 'idle' || state === 'done' || state === 'error') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const isDisabled = disabled || isUploading;

  // Label key per state

  function fmtMsec(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <View style={styles.container}>
      {/* Pulse ring (behind button when recording) */}
      {isRecording && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: c.error + '25',
              transform: [{ scale: pulseAnim }],
              opacity: pulseAnim.interpolate({ inputRange: [1, 1.14], outputRange: [0.7, 0] }),
            },
          ]}
        />
      )}

      <Animated.View style={{ transform: [{ scale: isRecording ? pulseAnim : 1 }] }}>
        <TouchableOpacity
          style={[
            styles.micBtn,
            {
              backgroundColor: isDisabled
                ? c.muted
                : isFinal
                ? c.success
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
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isFinal ? 'checkmark' : isRecording ? 'stop' : 'mic'}
                size={34}
                color="#fff"
              />
              {isRecording && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{fmtMsec(recordingMsec)}</Text>
                </View>
              )}
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    top: -13,
    left: -13,
  },
  micBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  durationBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    marginTop: tokens.spacing2 + 2,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: tokens.spacing2,
  },
});