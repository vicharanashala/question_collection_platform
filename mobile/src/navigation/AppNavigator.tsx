import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { LoadingScreen } from '../components/Loading';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { AuthStackParamList, MainTabParamList, RootStackParamList, AdminStackParamList } from './types';
import { tokens } from '../utils/theme';
import { UserRole, VerificationStatus } from '../types';
import { userApi } from '../api/client';

const isNormalUser = (role: string | undefined) => role === UserRole.USER;

// Auth screens
import { LoginPhoneScreen } from '../screens/Auth/LoginPhoneScreen';
import { OtpScreen } from '../screens/Auth/OtpScreen';
import { ConsentScreen } from '../screens/Auth/ConsentScreen';
import { TermsScreen } from '../screens/Auth/TermsScreen';
import { TermsOfServiceScreen } from '../screens/Auth/TermsOfServiceScreen';
import { PrivacyPolicyScreen } from '../screens/Auth/PrivacyPolicyScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { VerificationPendingScreen } from '../screens/Auth/VerificationPendingScreen';

// Main screens
import { HomeScreen } from '../screens/Home/HomeScreen';
import { SubmissionsScreen } from '../screens/Submissions/SubmissionsScreen';
import { QuestionScreen } from '../screens/Question/QuestionScreen';
import { WalletScreen } from '../screens/Wallet/WalletScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { EditProfileScreen } from '../screens/Profile/EditProfileScreen';
import { CropManagementScreen } from '../screens/Profile/CropManagementScreen';
import { NotificationScreen } from '../screens/Notification/NotificationScreen';
import { QuestionPreviewScreen } from '../screens/Question/QuestionPreviewScreen';
import { QuestionDetailScreen } from '../screens/Question/QuestionDetailScreen';

// Admin screens
import { AdminDashboardScreen } from '../screens/Admin/AdminDashboardScreen';
import { AdminQuestionsScreen } from '../screens/Admin/AdminQuestionsScreen';
import { AdminProcessedQuestionsScreen } from '../screens/Admin/AdminProcessedQuestionsScreen';
import { AdminQuestionDetailScreen } from '../screens/Admin/AdminQuestionDetailScreen';
import { AdminUsersScreen } from '../screens/Admin/AdminUsersScreen';
import { AdminCreateUserScreen } from '../screens/Admin/AdminCreateUserScreen';
import { AdminUserDetailScreen } from '../screens/Admin/AdminUserDetailScreen';
import { AdminConfigScreen } from '../screens/Admin/AdminConfigScreen';
import { AdminWithdrawalsScreen } from '../screens/Admin/AdminWithdrawalsScreen';
import { AdminProfileScreen } from '../screens/Admin/AdminProfileScreen';

// ─── Navigators ───────────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const AdminStackNav = createNativeStackNavigator<AdminStackParamList>();

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
      <AuthStack.Screen name="Terms" component={TermsScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      <AuthStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <AuthStack.Screen name="VerificationPending" component={VerificationPendingScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Admin Stack Navigator ────────────────────────────────────────────────────

function AdminNavigator() {
  const { theme } = useTheme();
  const c = theme.colors;
  const adminNav = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  const headerRight = () => (
    <TouchableOpacity
      style={{ marginRight: tokens.spacing3 }}
      onPress={() => adminNav.navigate('AdminProfile')}
    >
      <Ionicons name="person-circle" size={28} color={c.primary} />
    </TouchableOpacity>
  );

  const screenOpts = {
    headerStyle: { backgroundColor: c.surface },
    headerTintColor: c.text,
    headerShadowVisible: false,
    headerRight,
    headerBackTitleVisible: false,
  } as const;

  return (
    <AdminStackNav.Navigator screenOptions={screenOpts}>
      <AdminStackNav.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminCreateUser"
        component={AdminCreateUserScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminQuestions"
        component={AdminQuestionsScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminQuestionDetail"
        component={AdminQuestionDetailScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminProcessedQuestions"
        component={AdminProcessedQuestionsScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminConfig"
        component={AdminConfigScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminWithdrawals"
        component={AdminWithdrawalsScreen}
        options={{ headerShown: false }}
      />
      <AdminStackNav.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{ headerShown: false }}
      />
    </AdminStackNav.Navigator>
  );
}

// ─── Main Tab Navigator ───────────────────────────────────────────────────────

function MainNavigator() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const { toggleTheme, isDark } = useTheme();

  useFocusEffect(
    useCallback(() => {
      userApi.getNotifications({ limit: 1 }).then((r) => {
        setUnreadNotifs(r.data.unread ?? 0);
      }).catch(() => {});
    }, []),
  );

  // Also fetch on mount so the badge is visible immediately on app launch
  useEffect(() => {
    userApi.getNotifications({ limit: 1 }).then((r) => {
      console.log('[NOTIF BADGE] mount fetch -> unread:', r.data.unread, 'raw:', JSON.stringify(r.data));
      setUnreadNotifs(r.data.unread ?? 0);
    }).catch(() => {});
  }, []);

  return (
    <>
      {/* ── Custom header bar ─────────────────────────────── */}
      <View style={{ paddingTop: insets.top, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
        <View style={mainStyles.headerBar}>
          {/* App logo + name */}
          <View style={mainStyles.brand}>
            <Image source={require('../../assets/icon.png')} style={mainStyles.logo} />
            <View style={mainStyles.brandText}>
              <Text style={[mainStyles.appName, { color: c.text }]} numberOfLines={1}>AnnaDatha</Text>
              <Text style={[mainStyles.tagline, { color: c.textSecondary }]} numberOfLines={1}>Empowering Farmers</Text>
            </View>
          </View>

          {/* Action icons */}
          <View style={mainStyles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationScreen')}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={mainStyles.headerIcon}
            >
              <Ionicons name="notifications-outline" size={22} color={c.text} />
              {unreadNotifs > 0 && (
                <View style={[mainStyles.badge, { backgroundColor: c.error }]}>
                  <Text style={mainStyles.badgeText}>{unreadNotifs > 99 ? '99+' : unreadNotifs}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setLangModalVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={mainStyles.headerIcon}
            >
              <Ionicons name="language-outline" size={22} color={c.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => toggleTheme()}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={mainStyles.headerIcon}
            >
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={21} color={c.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <LanguageSwitcher visible={langModalVisible} onClose={() => setLangModalVisible(false)} />

      <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 72 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
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
    </>
  );
}

const mainStyles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    height: 56,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    flex: 1,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  brandText: {
    gap: 1,
  },
  appName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '500',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});

// ─── Pending Verification Navigator ─────────────────────────────────────────

const PendingStack = createNativeStackNavigator();

function PendingNavigator() {
  return (
    <PendingStack.Navigator screenOptions={{ headerShown: false }}>
      <PendingStack.Screen name="VerificationPending" component={VerificationPendingScreen} />
    </PendingStack.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

export function AppNavigator() {
  const { theme, isDark } = useTheme();
  const { user, isLoading, isReady } = useAuth();

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.CURATOR;

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            {user.verificationStatus === VerificationStatus.PENDING && isNormalUser(user.role) ? (
              <RootStack.Screen name="Auth" component={PendingNavigator} />
            ) : (
              <>
                <RootStack.Screen
                  name="Main"
                  component={isAdmin ? AdminNavigator : MainNavigator}
                />
                <RootStack.Screen
                  name="EditProfile"
                  component={EditProfileScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="CropManagement"
                  component={CropManagementScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="NotificationScreen"
                  component={NotificationScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="QuestionPreview"
                  component={QuestionPreviewScreen}
                  options={{ presentation: 'modal' }}
                />
                <RootStack.Screen
                  name="QuestionDetail"
                  component={QuestionDetailScreen}
                  options={{ presentation: 'modal' }}
                />
              </>
            )}
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}