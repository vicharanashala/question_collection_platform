import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  size = 'md',
}: ButtonProps) {
  const { theme } = useTheme();
  const c = theme.colors;

  const isDisabled = disabled || loading;

  const heightMap = { sm: 36, md: 48, lg: 56 };
  const paddingHMap = { sm: 16, md: 24, lg: 32 };
  const fontSizeMap = { sm: 13, md: 15, lg: 17 };

  const baseStyle: ViewStyle = {
    paddingVertical: (heightMap[size] - 20) / 2,
    paddingHorizontal: paddingHMap[size],
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  };

  const variantStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: isDisabled ? c.muted : c.primary },
    secondary: { backgroundColor: c.secondary },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: isDisabled ? c.borderSubtle : c.primary,
    },
    ghost: { backgroundColor: 'transparent' },
  };

  const textColors: Record<string, string> = {
    primary: isDisabled ? c.mutedForeground : c.primaryForeground,
    secondary: c.secondaryForeground,
    outline: isDisabled ? c.mutedForeground : c.primary,
    ghost: isDisabled ? c.mutedForeground : c.primary,
  };

  return (
    <TouchableOpacity
      style={[baseStyle, variantStyles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            { color: textColors[variant], fontSize: fontSizeMap[size], lineHeight: fontSizeMap[size] + 4 },
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

import { tokens } from '../utils/theme';

const styles = StyleSheet.create({
  text: { fontWeight: '600', letterSpacing: 0.025 * 16 },
  disabled: { opacity: 0.5 },
});