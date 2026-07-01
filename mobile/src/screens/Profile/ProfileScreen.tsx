import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { userApi, walletApi, questionApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { VerificationStatus, UserCategory, UserRole } from '../../types';
import type { WalletBalance } from '../../types';

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

export function ProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [userCrops, setUserCrops] = useState<{ id: string; cropName: string; season: string | null }[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);


  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const results = await Promise.allSettled([
        userApi.getProfile(),
        walletApi.getBalance(),
        questionApi.list({ page: 1, limit: 1 }),
      ]);

      if (results[0].status === 'fulfilled') {
        const crops = results[0].value.data?.crops ?? [];
        setUserCrops(crops.map((name: string) => ({ id: name, cropName: name, season: null })));
      }
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

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  function handleLogoutPress() {
    setShowLogoutConfirm(true);
  }

  async function handleLogoutConfirm() {
    setShowLogoutConfirm(false);
    await logout();
  }

  const statusColor = user?.verificationStatus ? (STATUS_CONFIG[user.verificationStatus]?.color ?? c.textTertiary) : null;

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

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
        </View>

        {/* ── Stats row ─────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {loadingData
              ? <View style={styles.statLoading}><ActivityIndicator size="small" color={c.primary} /></View>
              : <>
                  <Ionicons name="wallet-outline" size={18} color={c.primary} style={styles.statIcon} />
                  <Text style={[styles.statValue, { color: c.text }]}>₹{walletBalance ?? 0}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>{t('profile.wallet')}</Text>
                </>
            }
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {loadingData
              ? <View style={styles.statLoading}><ActivityIndicator size="small" color={c.primary} /></View>
              : <>
                  <Ionicons name="help-circle-outline" size={18} color={c.primary} style={styles.statIcon} />
                  <Text style={[styles.statValue, { color: c.text }]}>{totalQuestions ?? '—'}</Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>{t('profile.questions')}</Text>
                </>
            }
          </View>
          <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {loadingData
              ? <View style={styles.statLoading}><ActivityIndicator size="small" color={c.primary} /></View>
              : <>
                  <Ionicons name="calendar-outline" size={18} color={c.primary} style={styles.statIcon} />
                  <Text style={[styles.statValue, { color: c.text }]}>
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </Text>
                  <Text style={[styles.statLabel, { color: c.textSecondary }]}>{t('profile.memberSince')}</Text>
                </>
            }
          </View>
        </View>

        {/* ── Account details ───────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: c.primary + '15' }]}>
              <Ionicons name="person-outline" size={14} color={c.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Account</Text>
          </View>
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>

            {/* Personal Info */}
            <Text style={[styles.groupLabel, { color: c.textTertiary }]}>Personal Info</Text>
            <View style={styles.fieldGrid}>
              {user?.category && (
                <View style={styles.fieldCell}>
                  <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Category</Text>
                  <Text style={[styles.fieldValue, { color: c.text, textTransform: 'uppercase' }]}>{user.category}</Text>
                </View>
              )}
              {user?.gender && (
                <View style={styles.fieldCell}>
                  <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Gender</Text>
                  <Text style={[styles.fieldValue, { color: c.text, textTransform: 'uppercase' }]}>{user.gender}</Text>
                </View>
              )}
              {user?.age && (
                <View style={styles.fieldCell}>
                  <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Age</Text>
                  <Text style={[styles.fieldValue, { color: c.text }]}>{user.age}</Text>
                </View>
              )}
            </View>

            <View style={[styles.dividerLine, { backgroundColor: c.borderSubtle }]} />

            {/* Location */}
            <Text style={[styles.groupLabel, { color: c.textTertiary, marginTop: tokens.spacing3 }]}>Location</Text>
            <View style={styles.fieldGrid}>
              <View style={styles.fieldCell}>
                <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>State</Text>
                <Text style={[styles.fieldValue, { color: c.text }]}>{user?.state ?? '—'}</Text>
              </View>
              <View style={styles.fieldCell}>
                <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>District</Text>
                <Text style={[styles.fieldValue, { color: c.text }]}>{user?.district ?? '—'}</Text>
              </View>
              <View style={styles.fieldCell}>
                <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Block</Text>
                <Text style={[styles.fieldValue, { color: c.text }]}>{user?.block ?? '—'}</Text>
              </View>
              <View style={styles.fieldCell}>
                <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Village</Text>
                <Text style={[styles.fieldValue, { color: c.text }]}>{user?.village ?? '—'}</Text>
              </View>
              {user?.kvk && (
                <View style={styles.fieldCell}>
                  <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>KVK</Text>
                  <Text style={[styles.fieldValue, { color: c.text }]}>{user.kvk}</Text>
                </View>
              )}
            </View>

            {/* Education — students only */}
            {user?.category === 'student' && (
              <>
                <View style={[styles.dividerLine, { backgroundColor: c.borderSubtle }]} />
                <Text style={[styles.groupLabel, { color: c.textTertiary, marginTop: tokens.spacing3 }]}>Education</Text>
                <View style={styles.fieldGrid}>
                  {user?.courseName && (
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Course</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user.courseName}</Text>
                    </View>
                  )}
                  {user?.collegeName && (
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>College</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user.collegeName}</Text>
                    </View>
                  )}
                  {user?.universityName && (
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>University</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user.universityName}</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Farming — farmers only */}
            {user?.category === 'farmer' && (
              <>
                <View style={[styles.dividerLine, { backgroundColor: c.borderSubtle }]} />
                <Text style={[styles.groupLabel, { color: c.textTertiary, marginTop: tokens.spacing3 }]}>Farming</Text>
                <View style={styles.fieldGrid}>
                  {user?.farmSize && (
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Farm Size</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user.farmSize} acres</Text>
                    </View>
                  )}
                  {user?.cropType && (
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Crop</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user.cropType}</Text>
                    </View>
                  )}
                  {user?.season && (
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Season</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user.season}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Organisation details ──────────────────────────── */}
        {(user?.organizationState || user?.organizationDistrict || user?.organizationBlock || user?.organizationVillage || user?.organisationType || user?.organizationName || user?.organizationRole || user?.numberOfFarmers) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: c.primary + '15' }]}>
                <Ionicons name="business-outline" size={14} color={c.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Organisation Details</Text>
            </View>
            <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>

              {/* Org Info */}
              <Text style={[styles.groupLabel, { color: c.textTertiary }]}>Organisation</Text>
              <View style={styles.fieldGrid}>
                {user?.organisationType && (
                  <View style={styles.fieldCell}>
                    <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Org. Type</Text>
                    <Text style={[styles.fieldValue, { color: c.text }]}>{user.organisationType}</Text>
                  </View>
                )}
                {user?.organizationName && (
                  <View style={styles.fieldCell}>
                    <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Name</Text>
                    <Text style={[styles.fieldValue, { color: c.text }]}>{user.organizationName}</Text>
                  </View>
                )}
                {user?.organizationRole && (
                  <View style={styles.fieldCell}>
                    <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Role</Text>
                    <Text style={[styles.fieldValue, { color: c.text }]}>{user.organizationRole}</Text>
                  </View>
                )}
                {user?.numberOfFarmers != null && (
                  <View style={styles.fieldCell}>
                    <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Members</Text>
                    <Text style={[styles.fieldValue, { color: c.text }]}>{user.numberOfFarmers}</Text>
                  </View>
                )}
              </View>

              {/* Org Location */}
              {(user?.organizationState || user?.organizationDistrict || user?.organizationBlock || user?.organizationVillage) && (
                <>
                  <View style={[styles.dividerLine, { backgroundColor: c.borderSubtle }]} />
                  <Text style={[styles.groupLabel, { color: c.textTertiary, marginTop: tokens.spacing3 }]}>Organisation Location</Text>
                  <View style={styles.fieldGrid}>
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>State</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user?.organizationState ?? '—'}</Text>
                    </View>
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>District</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user?.organizationDistrict ?? '—'}</Text>
                    </View>
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Block</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user?.organizationBlock ?? '—'}</Text>
                    </View>
                    <View style={styles.fieldCell}>
                      <Text style={[styles.fieldLabel, { color: c.textTertiary }]}>Village</Text>
                      <Text style={[styles.fieldValue, { color: c.text }]}>{user?.organizationVillage ?? '—'}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Crops ──────────────────────────────────────────── */}
        {userCrops.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Crops</Text>
            <View style={styles.cropTags}>
              {userCrops.map((crop) => (
                <View key={crop.id} style={[styles.cropTag, { backgroundColor: c.primary + '14', borderColor: c.primary + '30' }]}>
                  <Ionicons name="leaf-outline" size={11} color={c.primary} />
                  <Text style={[styles.cropTagText, { color: c.primary }]}>{crop.cropName}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Actions ───────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, { backgroundColor: c.primary + '15' }]}>
              <Ionicons name="flash-outline" size={14} color={c.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Actions</Text>
          </View>
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
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

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ReportScreen')}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="flag-outline" size={16} color={c.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: c.text }]}>{t('report.title')}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => {
                const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
                if (email) Linking.openURL(`mailto:${email}`).catch(() => {});
              }}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="mail-outline" size={16} color={c.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: c.text }]}>Contact Admin</Text>
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
  sectionTitle: { fontSize: 14, fontWeight: '700' },
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
  dividerLine: { height: 1, marginTop: tokens.spacing3 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    marginBottom: tokens.spacing3,
    height: 28,
  },
  sectionIconWrap: {
    width: 26, height: 26,
    borderRadius: tokens.radius,
    alignItems: 'center', justifyContent: 'center',
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing3,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fieldCell: {
    width: '50%',
    paddingVertical: tokens.spacing1 + 1,
    paddingRight: tokens.spacing2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '700',
  },

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

  // ── Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: tokens.spacing4,
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
  statLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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