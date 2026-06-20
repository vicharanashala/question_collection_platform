import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TooltipIcon } from '../../components/TooltipIcon';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { userApi, walletApi, questionApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { VerificationStatus, UserCategory, UserRole } from '../../types';
import { ProfileCompletionWidget } from '../../components/ProfileCompletionWidget';
import type { CropDetail, WalletBalance } from '../../types';

const PRIVILEGED_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR];

const categoryLabels: Record<string, string> = {
  farmer: 'Farmer',
  fpo: 'FPO Member',
  student: 'Student',
  volunteer: 'Volunteer',
  ngo: 'NGO Partner',
};

const categoryIcons: Record<string, string> = {
  farmer: 'leaf-outline',
  fpo: 'people-outline',
  student: 'school-outline',
  volunteer: 'hand-right-outline',
  ngo: 'business-outline',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  verified:      { label: 'Verified',     color: '#22C55E', icon: 'checkmark-circle' },
  pending:       { label: 'Pending',      color: '#F59E0B', icon: 'time-outline' },
  manual_review: { label: 'Under Review', color: '#3B82F6', icon: 'eye-outline' },
  suspended:     { label: 'Suspended',    color: '#EF4444', icon: 'alert-circle-outline' },
  banned:        { label: 'Banned',       color: '#991B1B', icon: 'close-circle-outline' },
};

function getCategoryInfo(user: any): { label: string; value: string } | null {
  if (!user?.category) return null;
  const profileData = user.profileData ?? {};
  if (user.category === UserCategory.FARMER || user.category === UserCategory.FPO) {
    if (profileData.farmSize) return { label: 'Farm Size', value: profileData.farmSize };
    if (profileData.cropType) return { label: 'Primary Crop', value: profileData.cropType };
  }
  if (user.category === UserCategory.STUDENT) {
    if (profileData.courseName) return { label: 'Course', value: profileData.courseName };
    if (profileData.universityName) return { label: 'University', value: profileData.universityName };
  }
  if (user.category === UserCategory.VOLUNTEER || user.category === UserCategory.NGO) {
    if (profileData.memberRole) return { label: 'Role', value: profileData.memberRole };
    if (profileData.organisationName) return { label: 'Organisation', value: profileData.organisationName };
  }
  return null;
}

export function ProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [crops, setCrops] = useState<CropDetail[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const seasonLabels: Record<string, string> = {
    Kharif: t('season.Kharif'),
    Rabi: t('season.Rabi'),
    Zaid: t('season.Zaid'),
    'Pre-Kharif': t('season.Pre-Kharif'),
    'Post-Kharif': t('season.Post-Kharif'),
    'Pre-Rabi': t('season.Pre-Rabi'),
    'Zaid Rabi': t('season.Zaid Rabi'),
    Spring: t('season.Spring'),
    Summer: t('season.Summer'),
    Autumn: t('season.Autumn'),
    Winter: t('season.Winter'),
    Monsoon: t('season.Monsoon'),
    'Dry Season': t('season.Dry Season'),
    'Wet Season': t('season.Wet Season'),
  };

  function seasonLabel(raw: string | null) {
    if (!raw) return '';
    return seasonLabels[raw] ?? raw;
  }

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

  function handleLogoutPress() {
    setShowLogoutConfirm(true);
  }

  async function handleLogoutConfirm() {
    setShowLogoutConfirm(false);
    await logout();
  }

  function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
      <View style={styles.infoRow}>
        <View style={[styles.infoIconWrap, { backgroundColor: c.primary + '18' }]}>
          <Ionicons name={icon as any} size={13} color={c.primary} />
        </View>
        <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: c.text }]}>{value}</Text>
      </View>
    );
  }

  const statusColor = user?.verificationStatus ? (STATUS_CONFIG[user.verificationStatus]?.color ?? c.textTertiary) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={{ marginTop: tokens.spacing4 }}>
          <ProfileCompletionWidget onEdit={() => navigation.navigate('EditProfile')} hasCrops={crops.length > 0} />
        </View>

        {/* ── Hero card ─────────────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
          <View style={styles.heroTop}>
            {/* Avatar */}
            <View style={[styles.avatarRing, { borderColor: c.primary + '40' }]}>
              <View style={[styles.avatarCircle, { backgroundColor: c.primary }]}>
                <Text style={[styles.avatarInitial, { color: c.primaryForeground }]}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
              {user?.verificationStatus === VerificationStatus.VERIFIED && (
                <View style={[styles.avatarBadge, { backgroundColor: c.success, borderColor: c.surface }]}>
                  <Ionicons name="checkmark" size={8} color={c.surface} />
                </View>
              )}
            </View>

            {/* Name + meta */}
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, { color: c.text }]} numberOfLines={1}>
                {user?.name ?? 'Farmer'}
              </Text>
              {user?.mobileNumber && (
                <View style={styles.heroContactRow}>
                  <Ionicons name="call-outline" size={11} color={c.textSecondary} />
                  <Text style={[styles.heroContactText, { color: c.textSecondary }]}>{user.mobileNumber}</Text>
                </View>
              )}
              {!PRIVILEGED_ROLES.includes(user?.role as UserRole) && user?.category && (
                <View style={[styles.categoryBadge, { backgroundColor: c.primary + '15' }]}>
                  <Ionicons
                    name={(categoryIcons[user.category] ?? 'leaf-outline') as keyof typeof Ionicons.glyphMap}
                    size={10}
                    color={c.primary}
                  />
                  <Text style={[styles.categoryText, { color: c.primary }]}>
                    {categoryLabels[user.category] ?? ''}
                  </Text>
                </View>
              )}
            </View>

            {/* Verification pill — top right */}
            {statusColor && user && (
              <View style={[styles.verificationPill, { backgroundColor: statusColor + '18' }]}>
                <Ionicons
                  name={(STATUS_CONFIG[user.verificationStatus!]?.icon ?? 'help-circle') as keyof typeof Ionicons.glyphMap}
                  size={11}
                  color={statusColor}
                />
                <Text style={[styles.verificationText, { color: statusColor }]}>
                  {STATUS_CONFIG[user.verificationStatus!]?.label ?? user.verificationStatus}
                </Text>
              </View>
            )}
          </View>

          {/* Category-specific info strip */}
          {(() => {
            const info = getCategoryInfo(user);
            if (!info) return null;
            return (
              <View style={[styles.categoryStrip, { borderTopColor: c.borderSubtle }]}>
                <Text style={[styles.categoryStripLabel, { color: c.textTertiary }]}>{info.label}</Text>
                <Text style={[styles.categoryStripValue, { color: c.text }]}>{info.value}</Text>
              </View>
            );
          })()}
        </View>

        {/* ── Stats row ─────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {loadingData
              ? <ActivityIndicator size="small" color={c.primary} />
              : <>
                  <Ionicons name="wallet-outline" size={18} color={c.primary} style={styles.statIcon} />
                  <Text style={[styles.statValue, { color: c.text }]}>₹{walletBalance ?? 0}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>{t('profile.wallet')}</Text>
                </>
            }
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {loadingData
              ? <ActivityIndicator size="small" color={c.primary} />
              : <>
                  <Ionicons name="help-circle-outline" size={18} color={c.primary} style={styles.statIcon} />
                  <Text style={[styles.statValue, { color: c.text }]}>{totalQuestions ?? '—'}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>{t('profile.questions')}</Text>
                </>
            }
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <Ionicons name="calendar-outline" size={18} color={c.primary} style={styles.statIcon} />
            <Text style={[styles.statValue, { color: c.text }]}>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'}
            </Text>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>{t('profile.memberSince')}</Text>
          </View>
        </View>

        {/* ── Account details ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <InfoRow icon="call-outline" label="Mobile" value={user?.mobileNumber ?? '—'} />
            <InfoRow icon="location-outline" label="State" value={user?.state ?? '—'} />
            <InfoRow icon="map-outline" label="District" value={user?.district ?? '—'} />
            {user?.block && <InfoRow icon="business-outline" label="Block" value={user.block} />}
          </View>
        </View>

        {/* ── My Crops ──────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>{t('profile.myCrops')}</Text>
            {crops.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="leaf-outline" size={10} color={c.primary} />
                <Text style={[styles.countText, { color: c.primary }]}>{crops.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('CropManagement')}
          >
            {crops.length > 0 ? (
              <View style={styles.cropTags}>
                {crops.map((crop) => (
                  <View key={crop.id} style={[styles.cropTag, { backgroundColor: c.primary + '14', borderColor: c.primary + '30' }]}>
                    <Ionicons name="leaf-outline" size={11} color={c.primary} />
                    <Text style={[styles.cropTagText, { color: c.primary }]}>{crop.cropName}</Text>
                    {crop.season && (
                      <Text style={[styles.cropSeason, { color: c.textSecondary }]}> · {seasonLabel(crop.season)}</Text>
                    )}
                  </View>
                ))}
                <View style={[styles.manageCropsTag, { borderColor: c.border }]}>
                  <Ionicons name="add-circle-outline" size={11} color={c.textTertiary} />
                  <Text style={[styles.manageCropsText, { color: c.textTertiary }]}>Manage Crops</Text>
                </View>
              </View>
            ) : (
              <View style={styles.noCropsRow}>
                <View style={[styles.noCropsIconWrap, { backgroundColor: c.primary + '14' }]}>
                  <Ionicons name="leaf-outline" size={20} color={c.primary} />
                </View>
                <View style={styles.noCropsTextWrap}>
                  <Text style={[styles.noCropsTitle, { color: c.textSecondary }]}>
                    {t('profile.noCropsTitle', { defaultValue: 'No crops added yet' })}
                  </Text>
                  <Text style={[styles.noCropsHint, { color: c.textTertiary }]}>
                    {t('profile.noCropsHint', { defaultValue: 'Add crops to get relevant questions' })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Actions ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Actions</Text>
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="create-outline" size={16} color={c.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: c.text }]}>{t('profile.editProfile')}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: c.borderSubtle }]} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('PaymentDetails')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="wallet-outline" size={16} color={c.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: c.text }]}>Payment Methods</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: c.borderSubtle }]} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Leaderboard')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: c.success + '18' }]}>
                <Ionicons name="trophy-outline" size={16} color={c.success} />
              </View>
              <Text style={[styles.actionLabel, { color: c.text }]}>Leaderboard</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: c.borderSubtle }]} />

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={handleLogoutPress}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: c.error + '15' }]}>
                <Ionicons name="log-out-outline" size={16} color={c.error} />
              </View>
              <Text style={[styles.actionLabel, { color: c.error }]}>{t('profile.signOut')}</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      <ConfirmModal
        visible={showLogoutConfirm}
        title={t('profile.signOut')}
        message={t('profile.signOutConfirm')}
        confirmLabel={t('profile.signOutAction')}
        variant="danger"
        onConfirm={handleLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: tokens.spacing10 + 20 },

  // ── Shared
  section: { paddingHorizontal: tokens.spacing4, marginBottom: tokens.spacing5 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: tokens.spacing3, paddingLeft: 2 },
  sectionTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2,
    marginBottom: tokens.spacing3, paddingLeft: 2,
  },
  countBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: tokens.spacing2 + 2, paddingVertical: 2,
    borderRadius: tokens.radiusFull,
  },
  countText: { fontSize: 11, fontWeight: '700' },

  card: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    overflow: 'hidden',
  },

  divider: { height: 1, marginVertical: tokens.spacing1 },

  // ── Hero
  heroCard: {
    marginHorizontal: tokens.spacing4,
    marginTop: tokens.spacing4,
    marginBottom: tokens.spacing4,
    borderRadius: tokens.radiusLg,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing4,
    gap: tokens.spacing3,
  },
  avatarRing: {
    width: 60, height: 60,
    borderRadius: tokens.radiusFull,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarCircle: {
    width: 54, height: 54,
    borderRadius: tokens.radiusFull,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 24, fontWeight: '800' },
  avatarBadge: {
    position: 'absolute',
    bottom: -1, right: -1,
    width: 18, height: 18,
    borderRadius: tokens.radiusFull,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  heroInfo: { flex: 1, gap: 3 },
  heroName: { fontSize: 20, fontWeight: '800' },
  heroContactRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroContactText: { fontSize: 12, fontWeight: '500' },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing2 + 2,
    paddingVertical: 3,
    borderRadius: tokens.radiusFull,
    gap: 4,
  },
  categoryText: { fontSize: 11, fontWeight: '600' },
  verificationPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing2 + 2,
    paddingVertical: 4,
    borderRadius: tokens.radiusFull,
    gap: 4,
    flexShrink: 0,
  },
  verificationText: { fontSize: 11, fontWeight: '700' },

  // Category strip at bottom of hero
  categoryStrip: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderTopWidth: 1,
  },
  categoryStripLabel: { fontSize: 12, fontWeight: '600' },
  categoryStripValue: { fontSize: 13, fontWeight: '700' },

  // ── Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing4,
    gap: tokens.spacing2,
    marginBottom: tokens.spacing5,
  },
  statCard: {
    flex: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: { marginBottom: tokens.spacing1 },
  statValue: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  statLabel: { fontSize: 10, fontWeight: '500', marginTop: 2, textAlign: 'center' },

  // ── Info rows
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: tokens.spacing2 + 2,
    gap: tokens.spacing3,
  },
  infoIconWrap: {
    width: 26, height: 26,
    borderRadius: tokens.radius,
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 13, width: 72 },
  infoValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },

  // ── Crops
  cropTags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  cropTag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing1 + 2,
    borderRadius: tokens.radiusFull,
    borderWidth: 1,
    gap: 4,
  },
  cropTagText: { fontSize: 12, fontWeight: '600' },
  cropSeason: { fontSize: 11 },
  manageCropsTag: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing1 + 2,
    borderRadius: tokens.radiusFull,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 4,
  },
  manageCropsText: { fontSize: 11, fontWeight: '500' },

  noCropsRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: tokens.spacing3,
  },
  noCropsIconWrap: {
    width: 40, height: 40,
    borderRadius: tokens.radiusMd,
    alignItems: 'center', justifyContent: 'center',
  },
  noCropsTextWrap: { flex: 1 },
  noCropsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  noCropsHint: { fontSize: 12 },

  // ── Actions
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: tokens.spacing3 + 1,
    gap: tokens.spacing3,
  },
  actionIconWrap: {
    width: 34, height: 34,
    borderRadius: tokens.radius,
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
});