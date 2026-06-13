import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/hooks/useTheme';
import { AuthProvider } from './src/hooks/useAuth';
import { ToastProvider } from './src/components/Toast';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}