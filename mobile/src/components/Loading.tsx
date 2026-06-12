import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { tokens } from '../utils/theme';
import { useTheme } from '../hooks/useTheme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={[styles.message, { color: c.textSecondary }]}>{message}</Text>
    </View>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.banner, { backgroundColor: c.destructive + '18' }]}>
      <Text style={[styles.bannerText, { color: c.error }]}>{message}</Text>
      {onRetry && (
        <Text style={[styles.retry, { color: c.primary }]} onPress={onRetry}>Retry</Text>
      )}
    </View>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.emptyContainer}>
      {icon && <Text style={styles.emptyIcon}>{icon}</Text>}
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {message && <Text style={[styles.emptyMessage, { color: c.textSecondary }]}>{message}</Text>}
      {action && <View style={styles.emptyAction}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { marginTop: tokens.spacing3, fontSize: 14, letterSpacing: 0.01 * 14 },
  banner: {
    padding: tokens.spacing3,
    borderRadius: tokens.radiusMd,
    marginBottom: tokens.spacing3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerText: { flex: 1, fontSize: 14 },
  retry: { fontWeight: '700', marginLeft: tokens.spacing3 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing8,
    paddingVertical: tokens.spacing8 * 2,
  },
  emptyIcon: { fontSize: 48, marginBottom: tokens.spacing4 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: tokens.spacing2 },
  emptyMessage: { fontSize: 14, textAlign: 'center', marginBottom: tokens.spacing5 },
  emptyAction: { marginTop: tokens.spacing2 },
});