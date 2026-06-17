import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../hooks/useLanguage';
import { speechApi } from '../api/speech';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';
import { useToast } from './Toast';
import { useTranslation } from 'react-i18next';

type RecordingState = 'idle' | 'recording' | 'uploading' | 'done';

interface AudioRecorderProps {
  /**
   * Called with the transcribed text when recording succeeds.
   * The parent is responsible for filling it into the question text field.
   */
  onTranscribed: (text: string) => void;

  /** Show a label below the button */
  label?: string;
  /** Disable the recorder */
  disabled?: boolean;
}

export function AudioRecorder({ onTranscribed, label, disabled }: AudioRecorderProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();
  const { t } = useTranslation();

  const [state, setState] = useState<RecordingState>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        showToast(t('audio.permissionDenied') ?? 'Microphone permission required', 'error');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState('recording');
    } catch (err) {
      console.error('[AudioRecorder] startRecording error:', err);
      showToast(t('audio.startError') ?? 'Failed to start recording', 'error');
    }
  }

  async function stopAndUpload() {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;

    setState('uploading');

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error('No recording URI');

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload to backend which will forward to cloud storage (or use a signed upload endpoint)
      // For now we use a simple multipart upload via the speech endpoint with a data URI.
      // The real implementation should upload the file first to cloud storage and pass the URL.
      // Placeholder: construct a data URL (not recommended for large files in production)
      const audioDataUrl = `data:audio/mp4;base64,${base64}`;

      // Upload audio file — the backend will handle storage + transcription
      const result = await speechApi.transcribe(audioDataUrl, language);

      setState('done');
      onTranscribed(result.text);

      // Reset to idle after a short delay
      setTimeout(() => setState('idle'), 2000);
    } catch (err: unknown) {
      console.error('[AudioRecorder] upload error:', err);
      const msg =
        (err as { response?: { data?: { message?: string }; message?: string } })
          ?.response?.data?.message ??
        (err as Error)?.message ??
        t('audio.transcribeError') ??
        'Transcription failed. Please try again or type your question.';
      showToast(msg, 'error');
      setState('idle');
    }
  }

  function handlePress() {
    if (disabled) return;
    if (state === 'idle' || state === 'done') {
      startRecording();
    } else if (state === 'recording') {
      stopAndUpload();
    }
    // uploading state — button is disabled, ignore
  }

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const isDisabled = disabled || isUploading;
  const iconName = isRecording ? 'stop' : 'mic';

  return (
    <View style={styles.container}>
      <View style={styles.pulseWrap}>
        {/* Static pulse rings while recording */}
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
        {/* Main button */}
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