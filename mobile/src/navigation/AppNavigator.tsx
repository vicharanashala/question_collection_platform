import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { LoadingScreen } from '../components/Loading';
import { AuthStackParamList, MainTabParamList } from './types';

// Auth screens
import { LoginPhoneScreen } from '../screens/Auth/LoginPhoneScreen';
import { OtpScreen } from '../screens/Auth/OtpScreen';
import { ConsentScreen } from '../screens/Auth/ConsentScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';

// Main screens
import { HomeScreen } from '../screens/Home/HomeScreen';
import { SubmissionsScreen } from '../screens/Submissions/SubmissionsScreen';
import { QuestionScreen } from '../screens/Question/QuestionScreen';
import { WalletScreen } from '../screens/Wallet/WalletScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { EditProfileScreen } from '../screens/Profile/EditProfileScreen';

// ─── Type definitions ─────────────────────────────────────────────────────────

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  EditProfile: undefined;
};

// ─── Navigators ───────────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// ─── Tab Icon ─────────────────────────────────────────────────────────────────

interface TabIconProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  focused: boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={tabStyles.container}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={focused ? c.primary : c.textTertiary}
      />
      <Text
        style={[
          tabStyles.label,
          { color: focused ? c.primary : c.textTertiary },
          focused && tabStyles.labelActive,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: { width: 76, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  label: { fontSize: 10, marginTop: 3, letterSpacing: 0.2 },
  labelActive: { fontWeight: '700' },
});

// ─── Auth Navigator ───────────────────────────────────────────────────────────

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="LoginPhone" component={LoginPhoneScreen} />
      <AuthStack.Screen name="Otp" component={OtpScreen} />
      <AuthStack.Screen name="Consent" component={ConsentScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Main Tab Navigator ───────────────────────────────────────────────────────

function MainNavigator() {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: c.surface,
          borderTopWidth: 1,
          borderTopColor: c.borderSubtle,
        },
        tabBarShowLabel: false,
      }}
    >
      <MainTab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="home" label="Home" focused={focused} /> }}
      />
      <MainTab.Screen
        name="Submissions"
        component={SubmissionsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="list" label="Submissions" focused={focused} /> }}
      />
      <MainTab.Screen
        name="AskQuestion"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="create" label="Submit" focused={focused} /> }}
      >
        {() => {
          const route = useRoute<RouteProp<MainTabParamList, 'AskQuestion'>>();
          return <QuestionScreen route={route} />;
        }}
      </MainTab.Screen>
      <MainTab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="wallet" label="Wallet" focused={focused} /> }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="person" label="Profile" focused={focused} /> }}
      />
    </MainTab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

export function AppNavigator() {
  const { theme, isDark } = useTheme();
  const { user, isLoading, isReady } = useAuth();

  if (!isReady || isLoading) {
    return <LoadingScreen message="Starting app…" />;
  }

  const navTheme = {
    dark: isDark,
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.primary,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '900' as const },
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="Main" component={MainNavigator} />
            <RootStack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}