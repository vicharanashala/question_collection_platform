import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from './src/hooks/useTheme';
import { AuthProvider } from './src/hooks/useAuth';
import { LanguageProvider } from './src/hooks/useLanguage';
import { ToastProvider } from './src/components/Toast';
import { AccountLockedProvider } from './src/context/AccountLockedContext';
import { AccountLockedModal } from './src/components/AccountLockedModal';
import { AppNavigator } from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/types';
import './src/i18n';

export default function App() {
  const [ready, setReady] = useState(false);

  // Typed navigation ref for use in notification tap handler
  const rootNavigationRef = useNavigationContainerRef<RootStackParamList>();

  // Handle notification events and navigation
  useEffect(() => {
    // Required: tell expo-notifications how to handle notifications when received in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    // Respond to notification tap (foreground tap or app opened from background tap)
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { reportId?: string } | null;
      if (data?.reportId) {
        // navigationRef.current may be null on first render; defer to when it's ready
        if (rootNavigationRef.current) {
          rootNavigationRef.current.dispatch(
            CommonActions.navigate('ReportDetail', { reportId: data.reportId }),
          );
        } else {
          // If called before navigation is ready, set a one-time listener
          const readySub = rootNavigationRef.addListener('state', () => {
            rootNavigationRef.current?.dispatch(
              CommonActions.navigate('ReportDetail', { reportId: data.reportId }),
            );
            readySub();
          });
        }
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider>
            <ToastProvider>
              <AccountLockedProvider>
                <AppNavigator navigationRef={rootNavigationRef} />
                <AccountLockedModal />
              </AccountLockedProvider>
            </ToastProvider>
          </LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});