import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightElement,
  style,
  ...props
}: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, error && styles.inputError]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, leftIcon ? styles.inputWithLeftIcon : undefined, style]}
          placeholderTextColor="#9E9E9E"
          {...props}
        />
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function OtpInput({ length = 6, value, onChange, error }: OtpInputProps) {
  const refs = React.useRef<(TextInput | null)[]>([]);

  const digits = value.padEnd(length, '').slice(0, length).split('');

  function handleKeyPress(index: number, key: string) {
    if (key === 'Backspace') {
      if (value[index]) {
        const next = value.slice(0, index);
        onChange(next);
      } else if (index > 0) {
        const next = value.slice(0, index - 1);
        onChange(next);
        refs.current[index - 1]?.focus();
      }
      return;
    }
    if (!/^\d$/.test(key)) return;
    const next = value.slice(0, index) + key + value.slice(index + 1);
    onChange(next);
    if (index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <View>
      <View style={styles.otpRow}>
        {Array.from({ length }).map((_, i) => (
          <TextInput
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            style={[styles.otpBox, error && styles.otpError, digits[i] && styles.otpFilled]}
            value={digits[i] ?? ''}
            keyboardType="number-pad"
            maxLength={1}
            onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
            onChangeText={(text) => {
              if (!/^\d$/.test(text)) return;
              const next = value.slice(0, i) + text + value.slice(i + 1);
              onChange(next);
              if (i < length - 1) refs.current[i + 1]?.focus();
            }}
            onFocus={() => {
              refs.current[i]?.focus();
            }}
          />
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: '#E53935',
  },
  leftIcon: {
    paddingLeft: 12,
  },
  rightElement: {
    paddingRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#212121',
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  error: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
    backgroundColor: '#FAFAFA',
  },
  otpFilled: {
    borderColor: '#2E7D32',
    backgroundColor: '#F1F8E9',
  },
  otpError: {
    borderColor: '#E53935',
  },
});