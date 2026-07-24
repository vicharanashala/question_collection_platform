import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../hooks/useTheme';
import { tokens } from '../utils/theme';
import { WaveformBar, WAVE_BARS } from './WaveformBar';
import { getMediaUrl } from '../api/client';

type PlayState = 'idle' | 'loading' | 'playing' | 'paused';

interface AudioPlaybackCardProps {
  uri: string;
  onDelete: () => void;
}

export function AudioPlaybackCard({ uri, onDelete }: AudioPlaybackCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const [playState, setPlayState] = useState<PlayState>('idle');
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // Set duration immediately from URI query string (?dur=xxx)
  useEffect(() => {
    const m = uri.match(/\?dur=(\d+)/);
    if (m) setTotalSec(parseInt(m[1], 10) / 1000);
  }, [uri]);

  useEffect(() => {
    return () => {
      playerRef.current?.pause();
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  async function togglePlay() {
    const player = playerRef.current;

    if (playState === 'playing' && player) {
      player.pause();
      setPlayState('paused');
      return;
    }

    if (playState === 'paused' && player) {
      setPlayState('loading');
      try {
        await player.play();
        // play() resolved — actual playing state comes via the listener
        setPlayState('playing');
      } catch {
        setPlayState('paused');
      }
      return;
    }

    // Cold start: need to create the player
    const durMatch = uri.match(/\?dur=(\d+)/);
    const knownDur = durMatch ? parseInt(durMatch[1], 10) / 1000 : 0;
    const cleanUri = uri.replace(/\?dur=\d+$/, '');

    // Resolve relative paths to absolute URLs — required for downloadFirst + streaming
    const resolvedUri = getMediaUrl(cleanUri);
    console.log('[AudioPlaybackCard] play() URI (resolved):', resolvedUri);

    setPlayState('loading');

    // Ensure audio mode is configured for playback before creating the player
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    }).catch(() => {}); // non-fatal

    const newPlayer = createAudioPlayer(resolvedUri, { updateInterval: 250 });

    newPlayer.addListener('playbackStatusUpdate', (status: {
      currentTime: number;
      duration: number;
      playing: boolean;
      isLoaded: boolean;
      didJustFinish: boolean;
      error: string | null;
    }) => {
      console.log('[AudioPlaybackCard] statusUpdate:', JSON.stringify({
        isLoaded: status.isLoaded,
        playing: status.playing,
        currentTime: status.currentTime,
        duration: status.duration,
        didJustFinish: status.didJustFinish,
        error: status.error,
      }));
      if (!status.isLoaded) {
        if (status.error) {
          console.warn('[AudioPlaybackCard] load error:', status.error);
          playerRef.current?.remove();
          playerRef.current = null;
          setPlayState('idle');
        }
        return;
      }

      setCurrentSec(status.currentTime);
      if (status.duration > 0 && (knownDur === 0 || totalSec === 0)) {
        setTotalSec(status.duration);
      }

      if (status.didJustFinish) {
        newPlayer.remove();
        playerRef.current = null;
        setPlayState('idle');
        setCurrentSec(0);
        return;
      }

      // Sync playState with actual player state
      if (status.playing) {
        setPlayState('playing');
      } else if (!status.playing && playState === 'playing') {
        // Paused externally (e.g. another player took focus)
        setPlayState('paused');
      }
    });

    playerRef.current = newPlayer;

    try {
      await newPlayer.play();
      setPlayState('playing');
    } catch (err) {
      console.warn('[AudioPlaybackCard] play() failed:', err);
      playerRef.current = null;
      newPlayer.remove();
      setPlayState('idle');
    }
  }

  const isPlaying = playState === 'playing';
  const isLoading = playState === 'loading';
  const progress = totalSec > 0 ? currentSec / totalSec : 0;

  function fmt(s: number) {
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  function handleDelete() {
    playerRef.current?.pause();
    playerRef.current?.remove();
    playerRef.current = null;
    onDelete();
  }

  return (
    <View
      style={[
        playStyles.card,
        { backgroundColor: c.surfaceVariant, borderColor: c.borderSubtle },
      ]}
    >
      {/* Top row: play button + time + delete */}
      <View style={playStyles.topRow}>
        <TouchableOpacity
          style={[playStyles.playBtn, { backgroundColor: isLoading ? c.muted : c.primary }]}
          onPress={togglePlay}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
          )}
        </TouchableOpacity>

        <View style={playStyles.timeWrap}>
          <Text style={[playStyles.timeElap, { color: c.text }]}>{fmt(currentSec)}</Text>
          <Text style={[playStyles.timeSep, { color: c.textTertiary }]}> / </Text>
          <Text style={[playStyles.timeTot, { color: c.textSecondary }]}>{fmt(totalSec)}</Text>
        </View>

        <TouchableOpacity
          style={playStyles.delBtn}
          onPress={handleDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={22} color={c.error} />
        </TouchableOpacity>
      </View>

      {/* Waveform */}
      <View style={playStyles.waveRow}>
        {Array.from({ length: WAVE_BARS }, (_, i) => (
          <WaveformBar key={i} index={i} progress={progress} isPlaying={isPlaying} />
        ))}
      </View>
    </View>
  );
}

const playStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    padding: tokens.spacing4,
    gap: tokens.spacing3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing3,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  timeWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  timeElap: {
    fontSize: 16,
    fontWeight: '700',
  },
  timeSep: {
    fontSize: 13,
    fontWeight: '500',
  },
  timeTot: {
    fontSize: 13,
    fontWeight: '500',
  },
  delBtn: {
    flexShrink: 0,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 20,
    gap: 2,
  },
});