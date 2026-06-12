import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2E7D32" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>{message}</Text>
      {onRetry && (
        <Text style={styles.retry} onPress={onRetry}>Retry</Text>
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
  return (
    <View style={styles.emptyContainer}>
      {icon && <Text style={styles.emptyIcon}>{icon}</Text>}
      <Text style={styles.emptyTitle}>{title}</Text>
      {message && <Text style={styles.emptyMessage}>{message}</Text>}
      {action && <View style={styles.emptyAction}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  message: { marginTop: 12, fontSize: 14, color: '#757575' },
  banner: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 12,
  },
  bannerText: { flex: 1, color: '#C62828', fontSize: 14 },
  retry: { color: '#2E7D32', fontWeight: '700', marginLeft: 12 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#212121', textAlign: 'center', marginBottom: 8 },
  emptyMessage: { fontSize: 14, color: '#757575', textAlign: 'center', marginBottom: 24 },
  emptyAction: { marginTop: 8 },
});