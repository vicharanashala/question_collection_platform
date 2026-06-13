import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { walletApi, questionApi } from '../../api/client';
import { REWARD_TIERS, EDIT_WINDOW_SEC, DAILY_QUESTION_LIMIT } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { MainTabParamList } from '../../navigation/types';
import type { WalletBalance } from '../../types';

type Stats = { dailyCount: number; remainingToday: number };

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

export function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, refreshProfile } = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [refreshing, setRefreshing] = useState(false);

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  async function fetchDashboardData() {
    setLoadingStats(true);
    try {
      const [walletRes, statsRes] = await Promise.allSettled([
        walletApi.getBalance(),
        questionApi.getStats(),
      ]);
      if (walletRes.status === 'fulfilled') {
        const data = walletRes.value.data as WalletBalance;
        setWalletBalance(data.balance);
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data as Stats);
      }
    } catch (err) {
      // Non-fatal — dashboard shows defaults
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchDashboardData()]);
    setRefreshing(false);
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function StatCard({
    icon, label, value, color = c.primary,
  }: {
    icon: string; label: string; value: string; color?: string;
  }) {
    return (
      <View style={[styles.statCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
        <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={18} color={color} />
        </View>
        <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
      </View>
    );
  }

  function TierCard({
    tier, index,
  }: {
    tier: (typeof REWARD_TIERS)[number]; index: number;
  }) {
    const tierColors = [c.primary, '#0891B2', '#7C3AED'];
    const tierBg = [c.primary + '12', '#0891B212', '#7C3AED12'];
    const accentColor = tierColors[index % tierColors.length];
    const bg = tierBg[index % tierBg.length];
    const isTop = index === 0;
    return (
      <View
        style={[
          styles.tierCard,
          { backgroundColor: bg, borderColor: accentColor + '40', borderWidth: isTop ? 2 : 1 },
        ]}
      >
        {isTop && (
          <View style={[styles.tierBadge, { backgroundColor: accentColor }]}>
            <Text style={[styles.tierBadgeText, { color: '#fff' }]}>Best Value</Text>
          </View>
        )}
        <Text style={[styles.tierRange, { color: accentColor }]}>
          {tier.min}–{tier.max}{index === REWARD_TIERS.length - 1 ? '+' : ''} questions
        </Text>
        <Text style={[styles.tierReward, { color: c.text }]}>
          ₹{tier.reward}
          <Text style={[styles.tierPer, { color: c.textSecondary }]}> /question</Text>
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        {/* ── Hero greeting ──────────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: c.primary }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroGreeting}>{greeting},</Text>
              <Text style={styles.heroName}>{user?.name ?? 'Farmer'}</Text>
              <View style={[styles.categoryPill, { backgroundColor: '#ffffff22' }]}>
                <Text style={styles.categoryEmoji}>
                  {user?.category ? categoryEmoji[user.category] : '🌱'}
                </Text>
                <Text style={styles.categoryLabel}>
                  {user?.category ? categoryLabels[user.category] : 'Farmer'}
                </Text>
              </View>
            </View>
            <View style={[styles.avatarWrap, { backgroundColor: '#ffffff33' }]}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          </View>

          {user?.state && (
            <View style={styles.heroLocation}>
              <Ionicons name="location-outline" size={13} color="#ffffffcc" />
              <Text style={styles.heroLocationText}>
                {user.state}
                {user.district ? ` › ${user.district}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard
            icon="wallet-outline"
            label="Wallet Balance"
            value={loadingStats ? '…' : walletBalance !== null ? `₹${walletBalance}` : '—'}
            color={c.success}
          />
          <StatCard
            icon="checkmark-circle-outline"
            label="Today"
            value={
              loadingStats
                ? '…'
                : stats
                ? `${stats.dailyCount} done`
                : '—'
            }
            color={c.primary}
          />
          <StatCard
            icon="time-outline"
            label="Remaining"
            value={
              loadingStats
                ? '…'
                : stats
                ? `${stats.remainingToday}`
                : `${DAILY_QUESTION_LIMIT}`
            }
            color={c.warning}
          />
        </View>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            {[
              {
                icon: 'create-outline',
                label: 'Ask a Question',
                sub: 'Submit an agricultural query',
                screen: 'AskQuestion' as const,
                color: c.primary,
              },
              {
                icon: 'wallet-outline',
                label: 'My Wallet',
                sub: 'Rewards & withdrawals',
                screen: 'Wallet' as const,
                color: c.success,
              },
              {
                icon: 'document-text-outline',
                label: 'My Questions',
                sub: 'View all submissions',
                screen: 'Submissions' as const,
                color: '#0891B2',
              },
              {
                icon: 'person-outline',
                label: 'Edit Profile',
                sub: 'Update your details',
                screen: 'Profile' as const,
                color: '#7C3AED',
              },
            ].map((a) => (
              <TouchableOpacity
                key={a.screen}
                style={[styles.actionCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}
                activeOpacity={0.75}
                onPress={() => navigation.navigate(a.screen)}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: a.color + '18' }]}>
                  <Ionicons name={a.icon as any} size={22} color={a.color} />
                </View>
                <Text style={[styles.actionLabel, { color: c.text }]}>{a.label}</Text>
                <Text style={[styles.actionSub, { color: c.textSecondary }]}>{a.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Reward tiers ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Earn Rewards</Text>
            <View style={[styles.earnBadge, { backgroundColor: c.success + '18' }]}>
              <Ionicons name="trending-up" size={11} color={c.success} />
              <Text style={[styles.earnBadgeText, { color: c.success }]}>
                Per approved question
              </Text>
            </View>
          </View>
          <View style={styles.tierRow}>
            {REWARD_TIERS.map((tier, i) => (
              <TierCard key={tier.min} tier={tier} index={i} />
            ))}
          </View>
        </View>

        {/* ── Guidelines ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Submission Tips</Text>
          <View style={[styles.guideCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {[
              {
                icon: 'videocam-outline',
                text: `Video — Max ${EDIT_WINDOW_SEC}s, ${10}MB`,
                color: '#0891B2',
              },
              {
                icon: 'calendar-outline',
                text: `Daily limit — ${DAILY_QUESTION_LIMIT} questions per day`,
                color: c.primary,
              },
              {
                icon: 'pencil-outline',
                text: `Edit window — ${EDIT_WINDOW_SEC} seconds after submission`,
                color: c.warning,
              },
              {
                icon: 'bulb-outline',
                text: 'AI relevance check runs automatically before posting',
                color: '#7C3AED',
              },
            ].map((item, i) => (
              <View
                key={i}
                style={[
                  styles.guideRow,
                  i < 3 && { borderBottomWidth: 1, borderBottomColor: c.borderSubtle },
                ]}
              >
                <View style={[styles.guideIcon, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={14} color={item.color} />
                </View>
                <Text style={[styles.guideText, { color: c.textSecondary }]}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: tokens.spacing8 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    margin: tokens.spacing4,
    borderRadius: tokens.radiusXl,
    padding: tokens.spacing5,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLeft: { flex: 1 },
  heroGreeting: {
    fontSize: 14,
    color: '#ffffffcc',
    fontWeight: '500',
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing3 + 2,
    paddingVertical: tokens.spacing1 + 1,
    borderRadius: tokens.radiusFull,
    marginTop: tokens.spacing3,
    gap: 5,
  },
  categoryEmoji: { fontSize: 13 },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffffdd',
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: tokens.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: tokens.spacing4,
  },
  heroLocationText: {
    fontSize: 12,
    color: '#ffffffcc',
    fontWeight: '500',
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing4,
    gap: tokens.spacing3,
    marginBottom: tokens.spacing6,
  },
  statCard: {
    flex: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3 + 2,
    alignItems: 'center',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: tokens.spacing4,
    marginBottom: tokens.spacing6,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: tokens.spacing4,
  },
  earnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: tokens.spacing2 + 2,
    paddingVertical: tokens.spacing1,
    borderRadius: tokens.radiusFull,
    marginBottom: tokens.spacing4,
  },
  earnBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing3,
  },
  actionCard: {
    width: '47%',
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: tokens.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing3,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 3,
  },
  actionSub: {
    fontSize: 11,
    textAlign: 'center',
  },

  // ── Tiers ─────────────────────────────────────────────────────────────────
  tierRow: {
    flexDirection: 'row',
    gap: tokens.spacing3,
  },
  tierCard: {
    flex: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    alignItems: 'center',
    position: 'relative',
  },
  tierBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    paddingHorizontal: tokens.spacing2 + 2,
    paddingVertical: 2,
    borderRadius: tokens.radiusFull,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  tierRange: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  tierReward: {
    fontSize: 22,
    fontWeight: '800',
  },
  tierPer: {
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Guidelines ────────────────────────────────────────────────────────────
  guideCard: {
    borderRadius: tokens.radiusMd,
    overflow: 'hidden',
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3 + 2,
    gap: tokens.spacing3,
  },
  guideIcon: {
    width: 28,
    height: 28,
    borderRadius: tokens.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});