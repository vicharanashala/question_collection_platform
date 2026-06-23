import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
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

  // Keep onRecordingComplete ref fresh so it always calls the latest callback
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  onRecordingCompleteRef.current = onRecordingComplete;

  // Active recorder instance
  const recorderRef = useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null);
  // 5-second chunk timer
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-stop timer
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending chunk uploads (promise resolvers)
  const pendingChunksRef = useRef<PendingChunk[]>([]);
  // Sequence number counter
  const sequenceRef = useRef(0);
  // Whether a stop is in progress (prevents new chunks)
  const stoppingRef = useRef(false);

  const languageCode = language; // e.g. 'hi', 'ta', 'en'

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

        // Resolve the pending promise for this sequence
        const pending = pendingChunksRef.current.find((p) => p.sequenceNumber === seq);
        if (pending) {
          pending.resolve(data.text ?? '');
          pendingChunksRef.current = pendingChunksRef.current.filter(
            (p) => p.sequenceNumber !== seq,
          );
        }

        // Append transcript in order
        if (data.text) {
          setTranscriptSoFar((prev) => {
            const next = prev ? `${prev} ${data.text}` : data.text;
            onTranscribed(next);
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
    [languageCode, onTranscribed],
  );

  // ── Stop current chunk, upload it, start a new recording ─────────────────
  const cutChunkAndRestart = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || stoppingRef.current) return;

    // Stop this chunk
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      // Restart without uploading
      try {
        recorder.record();
      } catch { /* ignore */ }
      return;
    }

    // Assign sequence number and upload
    const seq = sequenceRef.current++;
    const pending: PendingChunk = {
      sequenceNumber: seq,
      resolve: () => {},
      reject: () => {},
    };
    // Create a deferred promise
    pendingChunksRef.current.push(pending);
    uploadChunk(uri, seq);

    // Start next chunk immediately
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err) {
      console.error('[AudioRecorder] failed to restart after chunk:', err);
    }
  }, [uploadChunk]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ── Start continuous recording ────────────────────────────────────────────
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

      // Cut and upload a chunk every 5 seconds
      chunkTimerRef.current = setInterval(() => {
        cutChunkAndRestart();
      }, CHUNK_INTERVAL_MS);

      // Hard auto-stop after MAX_RECORDING_SECONDS
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

  // ── Stop recording: cancel timer, upload remaining audio, resolve all ─────
  async function stopRecording() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    const recorder = recorderRef.current;
    if (!recorder) return;

    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
    chunkTimerRef.current = null;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = null;

    setState('uploading');

    try {
      // Stop and upload the final chunk
      await recorder.stop();
      const uri = recorder.uri;

      if (uri) {
        // Notify parent so it can show AudioPreview for playback
        onRecordingCompleteRef.current?.(uri);

        // Upload final chunk with a high sequence number
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
            onTranscribed(next);
            return next;
          });
        } else if (data.error) {
          showToast(t('audio.transcribeError') ?? 'Transcription failed', 'error');
        }
      }

      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch (err: unknown) {
      console.error('[AudioRecorder] stopRecording error:', err);
      showToast(
        (err as Error)?.message ??
          t('audio.transcribeError') ??
          'Transcription failed. Please try again.',
        'error',
      );
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
    // uploading — button disabled
  }

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const isDisabled = disabled || isUploading;
  const iconName = isRecording ? 'stop' : 'mic';

  return (
    <View style={styles.container}>
      <View style={styles.pulseWrap}>
        {isRecording && (
          <View
            style={[
              styles.pulseRing,
              styles.pulseRingOuter,
              { borderColor: c.primary + '20' },
            ]}
          />
        )}
        {isRecording && (
          <View
            style={[
              styles.pulseRing,
              styles.pulseRingInner,
              { borderColor: c.primary + '40' },
            ]}
          />
        )}
        <TouchableOpacity
          style={[
            styles.voiceBtn,
            { backgroundColor: isDisabled ? c.muted : c.primary },
          ]}
          onPress={handlePress}
          disabled={isDisabled}
          activeOpacity={0.8}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={iconName as 'mic' | 'stop'} size={28} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: c.textSecondary }]}>
        {isUploading
          ? t('audio.transcribing') ?? 'Transcribing…'
          : isRecording
          ? t('audio.recording') ?? 'Recording — tap to stop'
          : label ?? t('audio.record') ?? 'Tap to record'}
      </Text>

      {isRecording && (
        <View style={[styles.recordingBadge, { backgroundColor: c.error + '20' }]}>
          <View style={[styles.recordingDot, { backgroundColor: c.error }]} />
          <Text style={[styles.recordingText, { color: c.error }]}>
            {t('audio.recording') ?? 'Recording'}
          </Text>
        </View>
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
    borderWidth: 1.5,
  },
  pulseRingOuter: {
    width: 96,
    height: 96,
  },
  pulseRingInner: {
    width: 80,
    height: 80,
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
  label: {
    marginTop: tokens.spacing2,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  recordingBadge: {
    marginTop: tokens.spacing2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: '700',
  },
});