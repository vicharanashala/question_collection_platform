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
  Alert,
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
            <View>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Earn Rewards</Text>
              <Text style={[styles.sectionSub, { color: c.textSecondary }]}>
                ₹10 for 251–500 approved questions
              </Text>
            </View>
          </View>

          {/* Step path */}
          <View style={[styles.tierPath, { backgroundColor: c.surfaceVariant }]}>
            {/* Track line */}
            <View style={[styles.tierTrack, { backgroundColor: c.borderSubtle }]} />

            {REWARD_TIERS.map((tier, i) => {
              const colors = [c.warning, c.textSecondary, c.success];
              const icons = ['leaf', 'leaf', 'leaf'];
              const labels = ['Bronze', 'Silver', 'Gold'];
              const color = colors[i];
              const next = REWARD_TIERS[i + 1];

              return (
                <View key={tier.min} style={styles.tierStep}>
                  {/* Step node */}
                  <View style={[styles.tierNode, { backgroundColor: color }]}>
                    <Ionicons name={icons[i] as any} size={16} color="#fff" />
                  </View>

                  {/* Connector to next */}
                  {next && (
                    <View style={styles.tierConnector}>
                      <View
                        style={[
                          styles.tierConnectorFill,
                          { backgroundColor: color, width: '50%' },
                        ]}
                      />
                    </View>
                  )}

                  {/* Label below */}
                  <View style={styles.tierStepLabel}>
                    <Text style={[styles.tierStepName, { color }]}>{labels[i]}</Text>
                    <Text style={[styles.tierStepRange, { color: c.textSecondary }]}>
                      {tier.min}–{tier.max}Qs
                    </Text>
                    <Text style={[styles.tierStepReward, { color: c.text }]}>
                      ₹{tier.reward}/Q
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Total earnings potential card */}
          <TouchableOpacity
            style={[
              styles.earningsCard,
              { backgroundColor: c.success + '12', borderColor: c.success + '30', borderWidth: 1 },
            ]}
            activeOpacity={0.75}
            onPress={() => {
              if (stats && stats.remainingToday <= 0) {
                Alert.alert(
                  'Daily Limit Reached',
                  `You've used all ${DAILY_QUESTION_LIMIT} submissions for today. Try again tomorrow!`,
                );
              } else {
                navigation.navigate('AskQuestion');
              }
            }}
          >
            <View style={styles.earningsLeft}>
              <Ionicons name="trophy-outline" size={22} color={c.success} />
              <View>
                <Text style={[styles.earningsTitle, { color: c.text }]}>Reach Gold Tier</Text>
                <Text style={[styles.earningsSub, { color: c.textSecondary }]}>
                  Earn up to ₹10 per question after 250 approvals
                </Text>
              </View>
            </View>
            <View style={[styles.earningsArrow, { backgroundColor: c.success + '20' }]}>
              <Ionicons name="arrow-forward" size={14} color={c.success} />
            </View>
          </TouchableOpacity>
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
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 3,
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

  // ── Reward path ──────────────────────────────────────────────────────────
  tierPath: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing5,
    marginBottom: tokens.spacing4,
  },
  tierTrack: {
    position: 'absolute',
    top: tokens.spacing5 + 10,
    left: tokens.spacing5 + 18,
    right: tokens.spacing5 + 18,
    height: 3,
    borderRadius: 2,
  },
  tierStep: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  tierNode: {
    width: 36,
    height: 36,
    borderRadius: tokens.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tierConnector: {
    position: 'absolute',
    top: tokens.spacing5 + 10,
    left: '50%',
    right: '-50%',
    height: 3,
  },
  tierConnectorFill: {
    height: 3,
    borderRadius: 2,
  },
  tierStepLabel: {
    alignItems: 'center',
    marginTop: tokens.spacing3,
  },
  tierStepName: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  tierStepRange: {
    fontSize: 10,
    marginBottom: 2,
  },
  tierStepReward: {
    fontSize: 16,
    fontWeight: '800',
  },

  // ── Earnings card ─────────────────────────────────────────────────────────
  earningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
  },
  earningsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing3,
    flex: 1,
  },
  earningsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  earningsSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  earningsArrow: {
    width: 30,
    height: 30,
    borderRadius: tokens.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: tokens.spacing3,
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