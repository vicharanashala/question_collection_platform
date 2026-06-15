import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TooltipIcon } from '../../components/TooltipIcon';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import { userApi, walletApi, questionApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { VerificationStatus } from '../../types';
import { getLanguageName } from '../../utils/languageDetection';
import type { CropDetail, WalletBalance } from '../../types';
import type { SupportedLanguageCode } from '../../i18n';

const categoryLabels: Record<string, string> = {
  farmer: 'Farmer',
  fpo: 'FPO Member',
  student: 'Student',
  volunteer: 'Volunteer',
  ngo: 'NGO Partner',
};

const categoryEmoji: Record<string, string> = {
  farmer: '🌾',
  fpo: '🤝',
  student: '🎓',
  volunteer: '🙋',
  ngo: '🏢',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  verified:      { label: 'Verified',       color: '#22C55E', icon: 'checkmark-circle' },
  pending:       { label: 'Pending',        color: '#F59E0B', icon: 'time-outline' },
  manual_review: { label: 'Under Review',   color: '#3B82F6', icon: 'eye-outline' },
  suspended:     { label: 'Suspended',      color: '#EF4444', icon: 'alert-circle-outline' },
  banned:        { label: 'Banned',         color: '#991B1B', icon: 'close-circle-outline' },
};

type ProfileStats = { totalQuestions: number };

export function ProfileScreen() {
  const { theme, preference, setPreference } = useTheme();
  const c = theme.colors;
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const [crops, setCrops] = useState<CropDetail[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const results = await Promise.allSettled([
        userApi.getProfile(),
        walletApi.getBalance(),
        questionApi.list({ page: 1, limit: 1 }),
      ]);
      if (results[0].status === 'fulfilled') setCrops(results[0].value.data.crops ?? []);
      if (results[1].status === 'fulfilled') {
        setWalletBalance((results[1].value.data as WalletBalance).balance);
      }
      if (results[2].status === 'fulfilled') {
        const d = results[2].value.data as { total?: number };
        setTotalQuestions(d.total ?? null);
      }
    } catch { /* non-fatal */ }
    finally { setLoadingData(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
      <View style={styles.infoRow}>
        <View style={[styles.infoIconWrap, { backgroundColor: c.primary + '18' }]}>
          <Ionicons name={icon as any} size={14} color={c.primary} />
        </View>
        <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: c.text }]}>{value}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ─────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: c.heroBg }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={[styles.heroName, { color: c.heroFg }]}>{user?.name ?? 'Farmer'}</Text>
              <View style={[styles.categoryPill, { backgroundColor: c.heroFg + '22' }]}>
                <Text style={styles.categoryEmoji}>
                  {user?.category ? categoryEmoji[user.category] : '🌱'}
                </Text>
                <Text style={[styles.categoryLabel, { color: c.heroFg + 'dd' }]}>
                  {user?.category ? categoryLabels[user.category] : ''}
                </Text>
              </View>
            </View>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarWrap, { backgroundColor: c.heroFg + '33' }]}>
                <Text style={[styles.avatarText, { color: c.heroBg }]}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              {user?.verificationStatus === VerificationStatus.VERIFIED && (
                <View style={[styles.avatarBadge, { backgroundColor: '#22C55E' }]}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>
          </View>
          {user?.mobileNumber && (
            <View style={styles.heroContact}>
              <Ionicons name="call-outline" size={12} color={c.heroFg + 'aa'} />
              <Text style={[styles.heroContactText, { color: c.heroFg + 'aa' }]}>{user.mobileNumber}</Text>
            </View>
          )}
        </View>

        {/* ── Stats row ─────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {loadingData
              ? <ActivityIndicator size="small" color={c.primary} />
              : <>
                  <Ionicons name="wallet-outline" size={16} color={c.primary} style={styles.statIcon} />
                  <Text style={[styles.statValue, { color: c.text }]}>₹{walletBalance ?? 0}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>Wallet</Text>
                </>
            }
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {loadingData
              ? <ActivityIndicator size="small" color={c.primary} />
              : <>
                  <Ionicons name="help-circle-outline" size={16} color={c.primary} style={styles.statIcon} />
                  <Text style={[styles.statValue, { color: c.text }]}>{totalQuestions ?? '—'}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>Questions</Text>
                </>
            }
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <Ionicons name="calendar-outline" size={16} color={c.primary} style={styles.statIcon} />
            <Text style={[styles.statLabel, { color: c.textSecondary, marginBottom: 2 }]}>Member Since</Text>
            <Text style={[styles.statValue, { color: c.text, fontSize: 13 }]}>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'}
            </Text>
          </View>
        </View>

        {/* ── Location ──────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Location</Text>
            <TooltipIcon description="Your registered state, district, block, and preferred language for content delivery." />
          </View>
          <View style={[styles.infoCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <InfoRow icon="location-outline" label="State" value={user?.state ?? '—'} />
            <InfoRow icon="map-outline" label="District" value={user?.district ?? '—'} />
            {user?.block && <InfoRow icon="business-outline" label="Block" value={user.block} />}
            <TouchableOpacity
              style={styles.infoRow}
              activeOpacity={0.7}
              onPress={() => setLangModalVisible(true)}
            >
              <View style={[styles.infoIconWrap, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="chatbubbles-outline" size={14} color={c.primary} />
              </View>
              <Text style={[styles.infoLabel, { color: c.textSecondary }]}>
                {t('profile.language')}
              </Text>
              <View style={styles.languageValue}>
                <Text style={[styles.infoValue, { color: c.primary }]}>
                  {getLanguageName(language as SupportedLanguageCode)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={c.textTertiary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Language shortcut ──────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: c.surface, ...tokens.shadowSm }]}
            activeOpacity={0.75}
            onPress={() => setLangModalVisible(true)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
              <Ionicons name="language-outline" size={17} color={c.primary} />
            </View>
            <View style={styles.actionTextCol}>
              <Text style={[styles.actionTitle, { color: c.text }]}>
                {t('auth.selectLanguage')}
              </Text>
              <Text style={[styles.actionSub, { color: c.textSecondary }]}>
                {getLanguageName(language as SupportedLanguageCode)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ── Crops ─────────────────────────────────────────── */}
        {crops.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>My Crops</Text>
              <TooltipIcon description="The crops you have registered. Questions are tagged to specific crops for better relevance matching." />
            </View>
            <View style={[styles.cropsCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
              <View style={styles.cropTags}>
                {crops.map((crop) => (
                  <View key={crop.id} style={[styles.cropTag, { backgroundColor: c.primary + '18' }]}>
                    <Text style={[styles.cropTagText, { color: c.primary }]}>🌱 {crop.cropName}</Text>
                    {crop.season && (
                      <Text style={[styles.cropSeason, { color: c.textSecondary }]}> ({crop.season})</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ── Appearance ────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Appearance</Text>
            <TooltipIcon description="Choose Light, Dark, or follow your device settings." />
          </View>
          <View style={[styles.themeCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.themeOption, { borderBottomColor: c.borderSubtle, borderBottomWidth: mode !== 'system' ? 1 : 0 }]}
                activeOpacity={0.7}
                onPress={() => setPreference(mode)}
              >
                <View style={[styles.themeOptionIcon, { backgroundColor: mode === preference ? c.primary + '18' : c.surfaceVariant }]}>
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
                    {mode === 'light' ? 'Always light theme' : mode === 'dark' ? 'Always dark theme' : 'Follow device settings'}
                  </Text>
                </View>
                {mode === preference && <Ionicons name="checkmark-circle" size={18} color={c.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Actions ───────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: c.surface, ...tokens.shadowSm }]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
              <Ionicons name="create-outline" size={17} color={c.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: c.text }]}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: c.surface, ...tokens.shadowSm }]}
            activeOpacity={0.75}
            onPress={handleLogout}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: c.error + '15' }]}>
              <Ionicons name="log-out-outline" size={17} color={c.error} />
            </View>
            <Text style={[styles.actionTitle, { color: c.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LanguageSwitcher
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: tokens.spacing8 },

  // Hero
  hero: { margin: tokens.spacing4, borderRadius: tokens.radiusXl, padding: tokens.spacing5 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: tokens.spacing4 },
  heroLeft: { flex: 1 },
  heroName: { fontSize: 26, fontWeight: '800', marginBottom: tokens.spacing3 },
  categoryPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: tokens.spacing3 + 2, paddingVertical: tokens.spacing1 + 1, borderRadius: tokens.radiusFull, gap: 5 },
  categoryEmoji: { fontSize: 13 },
  categoryLabel: { fontSize: 12, fontWeight: '600' },
  avatarWrap: { width: 52, height: 52, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center' },
  avatarContainer: { position: 'relative' },
  avatarBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0D9488' },
  avatarText: { fontSize: 22, fontWeight: '800' },
  heroContact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroContactText: { fontSize: 12, fontWeight: '500' },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: tokens.spacing4, gap: tokens.spacing3, marginBottom: tokens.spacing6 },
  statCard: { flex: 1, borderRadius: tokens.radiusMd, padding: tokens.spacing3 + 2, alignItems: 'center', justifyContent: 'center', minHeight: 62 },
  statValue: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  statIcon: { marginBottom: tokens.spacing1 },
  statLabel: { fontSize: 10, fontWeight: '500', textAlign: 'center' },

  // Sections
  section: { paddingHorizontal: tokens.spacing4, marginBottom: tokens.spacing5 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginBottom: tokens.spacing3, paddingHorizontal: tokens.spacing4 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },

  // Info card
  infoCard: { borderRadius: tokens.radiusMd, padding: tokens.spacing4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.spacing3 - 2, gap: tokens.spacing3 },
  infoIconWrap: { width: 26, height: 26, borderRadius: tokens.radius, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 13, width: 72 },
  infoValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  languageValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // Crops
  cropsCard: { borderRadius: tokens.radiusMd, padding: tokens.spacing4 },
  cropTags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  cropTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing1 + 2, borderRadius: tokens.radiusFull },
  cropTagText: { fontSize: 13, fontWeight: '600' },
  cropSeason: { fontSize: 11 },

  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', borderRadius: tokens.radiusMd, padding: tokens.spacing4, marginBottom: tokens.spacing2, gap: tokens.spacing3 },
  actionIconWrap: { width: 36, height: 36, borderRadius: tokens.radius, alignItems: 'center', justifyContent: 'center' },
  actionTextCol: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600' },
  actionSub: { fontSize: 12, marginTop: 1 },

  // Theme
  themeCard: { borderRadius: tokens.radiusMd, overflow: 'hidden' },
  themeOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.spacing3 + 2, paddingHorizontal: tokens.spacing4, gap: tokens.spacing3 },
  themeOptionIcon: { width: 30, height: 30, borderRadius: tokens.radius, alignItems: 'center', justifyContent: 'center' },
  themeOptionText: { flex: 1 },
  themeOptionLabel: { fontSize: 14, fontWeight: '600' },
  themeOptionSub: { fontSize: 11, marginTop: 1 },
});