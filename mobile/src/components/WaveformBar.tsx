import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export const WAVE_BARS = 20;

interface WaveformBarProps {
  index: number;
  progress: number; // 0–1
  isPlaying: boolean;
}

export function WaveformBar({ index, progress, isPlaying }: WaveformBarProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Simple animated height driven by playback state
  const heightAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: isPlaying ? 1 : 0.35,
      duration: isPlaying ? 300 : 600,
      useNativeDriver: false,
    }).start();
  }, [isPlaying]);

  const isActive = index / WAVE_BARS < progress;
  const baseHeight = 4 + Math.sin((index / WAVE_BARS) * Math.PI) * 12;
  const targetHeight = isActive ? baseHeight : baseHeight * 0.4;

  const bgColor = isActive ? c.primary : c.borderSubtle;

  return (
    <View style={[waveStyles.bar, { backgroundColor: c.borderSubtle }]}>
      <Animated.View
        style={[
          waveStyles.fill,
          {
            backgroundColor: bgColor,
            // Interpolate between 40% and 100% of baseHeight
            height: heightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [baseHeight * 0.4, targetHeight],
            }),
          },
        ]}
      />
    </View>
  );
}

const waveStyles = StyleSheet.create({
  bar: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    borderRadius: 2,
  },
});