import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';

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
import { QuestionScreen } from '../screens/Question/QuestionScreen';
import { WalletScreen } from '../screens/Wallet/WalletScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { EditProfileScreen } from '../screens/Profile/EditProfileScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Ask: '❓',
    Wallet: '💰',
    Profile: '👤',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 22 }}>{icons[label] ?? '•'}</Text>
      <Text style={{ fontSize: 10, color: focused ? '#2E7D32' : '#9E9E9E', fontWeight: focused ? '700' : '400', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

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

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
        },
        tabBarShowLabel: false,
      }}
    >
      <MainTab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} /> }}
      />
      <MainTab.Screen
        name="AskQuestion"
        component={QuestionScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Ask" focused={focused} /> }}
      />
      <MainTab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Wallet" focused={focused} /> }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} /> }}
      />
    </MainTab.Navigator>
  );
}

export function AppNavigator() {
  const { isLoading, isReady, user } = useAuth();

  if (!isReady || isLoading) {
    return <LoadingScreen message="Starting app..." />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}