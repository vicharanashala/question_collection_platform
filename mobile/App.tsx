import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/hooks/useTheme';
import { AuthProvider } from './src/hooks/useAuth';
import { LanguageProvider } from './src/hooks/useLanguage';
import { ToastProvider } from './src/components/Toast';
import { AccountLockedProvider } from './src/context/AccountLockedContext';
import { AccountLockedModal } from './src/components/AccountLockedModal';
import { AppNavigator } from './src/navigation/AppNavigator';
import './src/i18n';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // i18n is ready once translations are loaded
    // The LanguageProvider will handle loading the saved preference
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
                <AppNavigator />
                {/* Renders as a Modal on top of the entire app when locked */}
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