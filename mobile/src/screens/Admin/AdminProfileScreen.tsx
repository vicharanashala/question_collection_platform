import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { getLanguageName } from '../../utils/languageDetection';
import { tokens } from '../../utils/theme';
import type { SupportedLanguageCode } from '../../i18n';

export function AdminProfileScreen() {
  const { theme, preference, setPreference } = useTheme();
  const c = theme.colors;
  const nav = useNavigation<any>();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [langModalVisible, setLangModalVisible] = useState(false);

  const infoRows: Array<{ label: string; value: string; icon: string }> = [
    { label: 'Name',    value: user?.name ?? '—',          icon: 'person' },
    { label: 'Mobile',  value: user?.mobileNumber ?? '—',  icon: 'call' },
    { label: 'Role',    value: user?.role ?? 'admin',      icon: 'shield-checkmark' },
    { label: 'State',   value: user?.state ?? '—',         icon: 'location' },
  ];

  async function handleLogout() {
    await logout();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text }]}>Admin Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={[styles.avatarWrap, { backgroundColor: c.primary + '18' }]}>
          <Text style={[styles.avatarText, { color: c.primary }]}>
            {(user?.name ?? 'A').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{user?.name ?? 'Admin'}</Text>
        <Text style={[styles.role, { color: c.textSecondary }]}>
          {user?.role?.replace('_', ' ').toUpperCase() ?? 'ADMIN'}
        </Text>

        {/* Info card */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {infoRows.map((row, i) => (
            <View key={row.label}>
              <View style={styles.infoRow}>
                <Ionicons name={row.icon as any} size={16} color={c.textTertiary} />
                <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>{row.value}</Text>
              </View>
              {i < infoRows.length - 1 && (
                <View style={[styles.divider, { backgroundColor: c.surfaceVariant }]} />
              )}
            </View>
          ))}
        </View>

        {/* ── Edit Profile ─────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: c.surface }]}
          activeOpacity={0.75}
          onPress={() => nav.navigate('EditProfile')}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="create-outline" size={17} color={c.primary} />
          </View>
          <Text style={[styles.actionTitle, { color: c.text }]}>{t('profile.editProfile')}</Text>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </TouchableOpacity>

        {/* ── Language ──────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.actionRow, { backgroundColor: c.surface }]}
          activeOpacity={0.75}
          onPress={() => setLangModalVisible(true)}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="language-outline" size={17} color={c.primary} />
          </View>
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: c.text }]}>{t('auth.selectLanguage')}</Text>
            <Text style={[styles.actionSub, { color: c.textSecondary }]}>
              {getLanguageName(language as SupportedLanguageCode)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
        </TouchableOpacity>

        {/* ── Appearance / Theme ─────────────────────────────── */}
        <View style={[styles.themeCard, { backgroundColor: c.surface }]}>
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.themeOption,
                { borderBottomColor: c.borderSubtle, borderBottomWidth: mode !== 'system' ? 1 : 0 },
              ]}
              activeOpacity={0.7}
              onPress={() => setPreference(mode)}
            >
              <View style={[
                styles.themeOptionIcon,
                { backgroundColor: mode === preference ? c.primary + '18' : c.surfaceVariant },
              ]}>
                <Ionicons
                  name={mode === 'light' ? 'sunny-outline' : mode === 'dark' ? 'moon-outline' : 'phone-portrait-outline'}
                  size={15}
                  color={mode === preference ? c.primary : c.textSecondary}
                />
              </View>
              <View style={styles.themeOptionText}>
                <Text style={[styles.themeOptionLabel, { color: c.text }]}>
                  {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'}
                </Text>
                <Text style={[styles.themeOptionSub, { color: c.textSecondary }]}>
                  {mode === 'light' ? 'Always light theme'
                    : mode === 'dark' ? 'Always dark theme'
                    : 'Follow device settings'}
                </Text>
              </View>
              {mode === preference && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Sign out ──────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: c.error + '18' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color={c.error} />
          <Text style={[styles.logoutText, { color: c.error }]}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <LanguageSwitcher
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: tokens.spacing5, paddingBottom: tokens.spacing3,
  },
  screenTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { padding: tokens.spacing5, paddingBottom: tokens.spacing8 },

  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: tokens.spacing3,
  },
  avatarText: { fontSize: 32, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  role: { fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: tokens.spacing5, textAlign: 'center' },

  card: {
    width: '100%', borderRadius: tokens.radiusMd,
    padding: tokens.spacing4, marginBottom: tokens.spacing4,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 13, width: 60 },
  infoValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  divider: { height: 1, marginVertical: tokens.spacing2 },

  // Actions
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: tokens.radiusMd, padding: tokens.spacing4,
    marginBottom: tokens.spacing2, gap: tokens.spacing3,
  },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: tokens.radius,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTextCol: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600' },
  actionSub: { fontSize: 12, marginTop: 1 },

  // Theme
  themeCard: {
    width: '100%', borderRadius: tokens.radiusMd,
    overflow: 'hidden', marginBottom: tokens.spacing2,
  },
  themeOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: tokens.spacing3 + 2, paddingHorizontal: tokens.spacing4,
    gap: tokens.spacing3,
  },
  themeOptionIcon: {
    width: 30, height: 30, borderRadius: tokens.radius,
    alignItems: 'center', justifyContent: 'center',
  },
  themeOptionText: { flex: 1 },
  themeOptionLabel: { fontSize: 14, fontWeight: '600' },
  themeOptionSub: { fontSize: 11, marginTop: 1 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing4, marginTop: tokens.spacing3,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
});