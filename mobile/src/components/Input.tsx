import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { tokens } from '../utils/theme';
import { useTheme as useThemed } from '../hooks/useTheme';

// ─── Shared Input wrapper ─────────────────────────────────────────────────────

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.memo(function Input({ label, error, hint, leftIcon, rightElement, style, ...props }: InputProps) {
  const { theme } = useThemed();
  const c = theme.colors;

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      )}
      <View
        style={[
          styles.inputRow,
          {
            borderColor: error ? c.error : c.borderSubtle,
            backgroundColor: c.input,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            leftIcon ? { paddingLeft: tokens.spacing1 } : undefined,
            { color: c.text },
            style,
          ]}
          placeholderTextColor={c.textTertiary}
          {...props}
        />
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>
      {error && <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>}
      {hint && !error && <Text style={[styles.hintText, { color: c.textTertiary }]}>{hint}</Text>}
    </View>
  );
});

// ─── OTP Input ────────────────────────────────────────────────────────────────

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function OtpInput({ length = 6, value, onChange, error }: OtpInputProps) {
  const { theme } = useThemed();
  const c = theme.colors;
  const refs = React.useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(length, '').slice(0, length).split('');

  // Paste via long-pressing any box — the OS pastes the full string into onChangeText.
  // Multi-char input (>1 char) is a paste; single char is a normal keystroke.
  function handleDigitChange(i: number, raw: string) {
    // Strip non-digits
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 1) {
      // Normal single keystroke
      const next = value.slice(0, i) + digits + value.slice(i + 1);
      onChange(next);
      if (digits && i < length - 1) refs.current[i + 1]?.focus();
    } else {
      // Paste: digits.length >= 2 — fill from position i onwards
      const filled = value.slice(0, i) + digits.slice(0, length - i);
      onChange(filled.slice(0, length));
      // Focus last filled box (or last box if paste was short)
      const lastIndex = Math.min(i + digits.length - 1, length - 1);
      refs.current[Math.max(0, lastIndex)]?.focus();
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key !== 'Backspace') return;
    if (value[index]) {
      onChange(value.slice(0, index));
    } else if (index > 0) {
      onChange(value.slice(0, index - 1));
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View>
      <View style={styles.otpRow}>
        {Array.from({ length }).map((_, i) => (
          <TextInput
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            style={[
              styles.otpBox,
              {
                borderColor: error
                  ? c.error
                  : digits[i]
                  ? c.focus
                  : c.borderSubtle,
                backgroundColor: c.input,
                color: c.text,
              },
            ]}
            value={digits[i] ?? ''}
            keyboardType="number-pad"
            maxLength={1}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            onChangeText={(text) => handleDigitChange(i, text)}
            placeholderTextColor={c.textTertiary}
            placeholder="•"
          />
        ))}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: c.error, textAlign: 'center', marginTop: tokens.spacing2 }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── Styles (shared base — colour applied inline via theme) ───────────────────

const styles = StyleSheet.create({
  wrapper: { marginBottom: tokens.spacing4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing1, letterSpacing: 0.01 * 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
  },
  leftIcon: { paddingLeft: tokens.spacing3, justifyContent: 'center', alignItems: 'center', height: 48 },
  rightElement: { paddingRight: tokens.spacing3 },
  input: {
    flex: 1,
    paddingVertical: tokens.spacing3,
    paddingHorizontal: tokens.spacing3 + 2,
    fontSize: 15,
  },
  errorText: { fontSize: 12, marginTop: tokens.spacing1, letterSpacing: 0.01 * 12 },
  hintText: { fontSize: 12, marginTop: tokens.spacing1, letterSpacing: 0.01 * 12 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: tokens.spacing2 + 2 },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderRadius: tokens.radiusMd,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
  },
});