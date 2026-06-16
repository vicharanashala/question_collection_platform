import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

// ─── Data types ───────────────────────────────────────────────────────────────

interface DashboardStats {
  summary: {
    totalQuestions: number;
    approvedQuestions: number;
    rejectedQuestions: number;
    pendingQuestions: number;
    totalUsers: number;
    flaggedQuestions: number;
    approvalRate: number;
  };
  stateBreakdown: Array<{ state: string; count: number }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
  dailyVolume: Array<{ date: string; total: number; approved: number }>;
}

interface RewardSummary {
  totalRewarded: number;
  rewardCount: number;
  avgReward: number;
  totalWithdrawn: number;
  withdrawalCount: number;
  pendingWithdrawals: number;
}

interface QueueItem {
  id: string;
  questionText: string;
  status: string;
  submittedAt: string;
  state: string;
  user: { name?: string; mobileNumber: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pending',     color: '#92400E', bg: '#FEF3C7' },
  ai_review:    { label: 'AI Review',   color: '#5B21B6', bg: '#EDE9FE' },
  human_review: { label: 'Manual',      color: '#0E7490', bg: '#E0F2FE' },
  approved:     { label: 'Approved',    color: '#065F46', bg: '#D1FAE5' },
  rejected:     { label: 'Rejected',    color: '#991B1B', bg: '#FEE2E2' },
};

// ─── Reusable Card ────────────────────────────────────────────────────────────

function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[
        cardStyles.card,
        { backgroundColor: c.card, borderColor: c.border },
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      {children}
    </Wrapper>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={sectionHeaderStyles.row}>
      <Text style={[sectionHeaderStyles.title, { color: c.foreground }]}>{title}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={sectionHeaderStyles.action} onPress={onAction} activeOpacity={0.6}>
          <Text style={[sectionHeaderStyles.actionText, { color: c.primary }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color={c.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <View style={[chipStyles.chip, { borderColor: color + '40' }]}>
      <Text style={[chipStyles.value, { color }]}>{value}</Text>
      <Text style={chipStyles.label}>{label}</Text>
      {sub && <Text style={[chipStyles.sub, { color: color + '99' }]}>{sub}</Text>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    ...tokens.shadowXs,
  },
});

const sectionHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing3,
  },
  title: { fontSize: 15, fontWeight: '700' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontSize: 13, fontWeight: '600' },
});

const chipStyles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3,
    paddingHorizontal: tokens.spacing4,
    flex: 1,
    gap: 3,
  },
  value: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  label: { fontSize: 11.5, fontWeight: '600', color: '#6B7280' },
  sub: { fontSize: 10.5, fontWeight: '500' },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rewards, setRewards] = useState<RewardSummary | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getRewardSummary(),
      ]);
      setStats(s.data);
      setRewards(r.data);
      try {
        const [qs1, qs2] = await Promise.all([
          adminApi.getReviewQueue({ queueType: 'pending', page: 1, limit: 5 }),
          adminApi.getReviewQueue({ queueType: 'human_review', page: 1, limit: 3 }),
        ]);
        setQueue([
          ...(qs1.data?.items ?? []),
          ...(qs2.data?.items ?? []),
        ].slice(0, 6));
      } catch { /* non-critical */ }
    } catch (e) {
      console.warn('[AdminDashboard]', getErrorMessage(e, 'Failed to load'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch();
  }

  async function quickApprove(questionId: string) {
    setActionLoading(questionId);
    try {
      await adminApi.reviewQuestion(questionId, { action: 'approve' });
      setQueue((prev) => prev.filter((q) => q.id !== questionId));
    } catch (e) {
      console.warn('[AdminDashboard] quick approve error:', getErrorMessage(e, ''));
    } finally {
      setActionLoading(null);
    }
  }

  async function quickReject(questionId: string) {
    setActionLoading(questionId);
    try {
      await adminApi.reviewQuestion(questionId, { action: 'reject' });
      setQueue((prev) => prev.filter((q) => q.id !== questionId));
    } catch (e) {
      console.warn('[AdminDashboard] quick reject error:', getErrorMessage(e, ''));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  const s = stats?.summary;
  const pendingCount = s?.pendingQuestions ?? 0;
  const approvalRate = s?.approvalRate ?? 0;
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >

        {/* ── Greeting header ───────────────────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: c.heroBg ?? c.primaryBg ?? c.primary }]}>
          <View style={styles.heroLeft}>
            <Text style={[styles.heroDate, { color: (c.heroFg ?? c.primaryForeground) + '99' }]}>{today}</Text>
            <Text style={[styles.heroName, { color: c.heroFg ?? c.primaryForeground }]}>{user?.name ?? 'Admin'}</Text>
            {pendingCount > 0 && (
              <View style={[styles.heroBadge, { backgroundColor: (c.heroFg ?? c.primaryForeground) + '20' }]}>
                <Ionicons name="alert-circle" size={12} color={c.heroFg ?? c.primaryForeground} />
                <Text style={[styles.heroBadgeText, { color: c.heroFg ?? c.primaryForeground }]}>
                  {pendingCount} question{pendingCount > 1 ? 's' : ''} need review
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.heroAvatar, { backgroundColor: (c.heroFg ?? c.primaryForeground) + '25' }]}
            onPress={() => navigation.navigate('AdminProfile')}
            activeOpacity={0.7}
          >
            <Text style={[styles.heroAvatarText, { color: c.heroFg ?? c.primaryForeground }]}>
              {(user?.name ?? 'A').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Question KPIs ─────────────────────────────────────────────── */}
        <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
          <SectionHeader
            title="Questions"
            actionLabel="View all"
            onAction={() => navigation.navigate('AdminQuestions')}
          />
          <View style={styles.chipRow}>
            <StatChip
              label="Total"
              value={fmt(s?.totalQuestions ?? 0)}
              color="#0D9488"
            />
            <StatChip
              label="Approved"
              value={fmt(s?.approvedQuestions ?? 0)}
              color="#059669"
              sub={`${approvalRate}%`}
            />
          </View>
          <View style={[styles.chipRow, { marginTop: tokens.spacing2 }]}>
            <StatChip
              label="Pending"
              value={String(pendingCount)}
              color={pendingCount > 0 ? '#D97706' : '#9CA3AF'}
              sub={pendingCount > 10 ? 'High load' : pendingCount > 0 ? 'Needs attention' : 'All clear'}
            />
            <StatChip
              label="Rejected"
              value={fmt(s?.rejectedQuestions ?? 0)}
              color="#DC2626"
            />
          </View>
          {s && s.flaggedQuestions > 0 && (
            <View style={[styles.chipRow, { marginTop: tokens.spacing2 }]}>
              <StatChip
                label="Flagged"
                value={String(s.flaggedQuestions)}
                color="#B45309"
                sub="Needs investigation"
              />
              <View style={{ flex: 1 }} />
            </View>
          )}
        </View>

        {/* ── User stats ────────────────────────────────────────────────── */}
        <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
          <SectionHeader
            title="Users"
            actionLabel="Manage"
            onAction={() => navigation.navigate('AdminUsers')}
          />
          <Card>
            <View style={userStatsStyles.row}>
              <View style={userStatsStyles.item}>
                <Ionicons name="people" size={20} color={c.primary} />
                <Text style={[userStatsStyles.num, { color: c.foreground }]}>
                  {fmt(s?.totalUsers ?? 0)}
                </Text>
                <Text style={[userStatsStyles.lbl, { color: c.mutedForeground }]}>Total Users</Text>
              </View>
              <View style={[userStatsStyles.divider, { backgroundColor: c.border }]} />
              <View style={userStatsStyles.item}>
                <Ionicons name="shield-checkmark" size={20} color="#059669" />
                <Text style={[userStatsStyles.num, { color: c.foreground }]}>
                  {fmt(s?.totalUsers ?? 0)}
                </Text>
                <Text style={[userStatsStyles.lbl, { color: c.mutedForeground }]}>Verified</Text>
              </View>
              <View style={[userStatsStyles.divider, { backgroundColor: c.border }]} />
              <View style={userStatsStyles.item}>
                <Ionicons name="flag" size={20} color="#DC2626" />
                <Text style={[userStatsStyles.num, { color: c.foreground }]}>
                  {String(s?.flaggedQuestions ?? 0)}
                </Text>
                <Text style={[userStatsStyles.lbl, { color: c.mutedForeground }]}>Flagged</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* ── Review queue ──────────────────────────────────────────────── */}
        {queue.length > 0 && (
          <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
            <SectionHeader
              title="Needs Review"
              actionLabel="View all"
              onAction={() => navigation.navigate('AdminQuestions')}
            />
            {queue.map((q) => {
              const meta = STATUS_META[q.status] ?? {
                label: q.status,
                color: c.mutedForeground ?? '#6B7280',
                bg: c.muted ?? '#F3F4F6',
              };
              const isLoading = actionLoading === q.id;
              return (
                <Card key={q.id} style={{ marginBottom: tokens.spacing2 }}>
                  <View style={queueStyles.header}>
                    <View style={[queueStyles.pill, { backgroundColor: meta.bg }]}>
                      <View style={[queueStyles.dot, { backgroundColor: meta.color }]} />
                      <Text style={[queueStyles.pillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={[queueStyles.time, { color: c.mutedForeground }]}>
                      {formatDate(q.submittedAt)}
                    </Text>
                  </View>
                  <Text style={[queueStyles.question, { color: c.foreground }]} numberOfLines={2}>
                    {q.questionText}
                  </Text>
                  <View style={queueStyles.footer}>
                    <View style={queueStyles.metaRow}>
                      <Ionicons name="location-outline" size={11} color={c.mutedForeground} />
                      <Text style={[queueStyles.metaText, { color: c.mutedForeground }]}>{q.state}</Text>
                    </View>
                    <View style={queueStyles.actions}>
                      <TouchableOpacity
                        style={[queueStyles.btn, { backgroundColor: '#05966915' }]}
                        onPress={() => quickApprove(q.id)}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        {isLoading
                          ? <ActivityIndicator size={12} color="#059669" />
                          : <Ionicons name="checkmark" size={15} color="#059669" />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[queueStyles.btn, { backgroundColor: '#DC262615' }]}
                        onPress={() => quickReject(q.id)}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        {isLoading
                          ? <ActivityIndicator size={12} color="#DC2626" />
                          : <Ionicons name="close" size={15} color="#DC2626" />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[queueStyles.btn, { backgroundColor: c.primary + '15' }]}
                        onPress={() => navigation.navigate('AdminQuestionDetail', { questionId: q.id })}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="chevron-forward" size={15} color={c.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* ── Rewards ───────────────────────────────────────────────────── */}
        {rewards && (
          <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
            <SectionHeader title="Rewards & Payouts" />
            <View style={styles.chipRow}>
              <StatChip
                label="Total Rewarded"
                value={formatINR(rewards.totalRewarded)}
                color="#059669"
                sub={`${rewards.rewardCount} rewards`}
              />
              <StatChip
                label="Avg. Reward"
                value={formatINR(Math.round(rewards.avgReward))}
                color="#7C3AED"
              />
            </View>
            <View style={[styles.chipRow, { marginTop: tokens.spacing2 }]}>
              <StatChip
                label="Withdrawn"
                value={formatINR(rewards.totalWithdrawn)}
                color="#D97706"
                sub={`${rewards.withdrawalCount} txns`}
              />
              <TouchableOpacity
                style={[
                  chipStyles.chip,
                  { flex: 1, borderColor: rewards.pendingWithdrawals > 0 ? c.warning + '50' : c.borderSubtle },
                ]}
                onPress={() => rewards.pendingWithdrawals > 0 && navigation.navigate('AdminWithdrawals')}
                activeOpacity={rewards.pendingWithdrawals > 0 ? 0.6 : 1}
              >
                <Text style={[chipStyles.value, { color: rewards.pendingWithdrawals > 0 ? c.warning : '#9CA3AF' }]}>
                  {String(rewards.pendingWithdrawals)}
                </Text>
                <Text style={chipStyles.label}>Pending Payouts</Text>
                {rewards.pendingWithdrawals > 0 && (
                  <Text style={[chipStyles.sub, { color: c.warning + 'bb' }]}>Tap to review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Quick nav ─────────────────────────────────────────────────── */}
        <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
          <SectionHeader title="Quick Access" />
          <View style={styles.navGrid}>
            {[
              { label: 'Users',       sub: 'Manage accounts',      icon: 'people',         screen: 'AdminUsers'       as any, color: '#0891B2' },
              { label: 'Questions',   sub: 'Review & moderate',     icon: 'document-text',  screen: 'AdminQuestions'   as any, color: c.primary },
              { label: 'Withdrawals', sub: 'Approve payouts',        icon: 'card',           screen: 'AdminWithdrawals' as any, color: '#D97706' },
              { label: 'Config',      sub: 'System settings',        icon: 'settings',       screen: 'AdminConfig'      as any, color: '#6B7280' },
            ].map((item) => (
              <Card
                key={item.screen}
                style={styles.navCard}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={[navIconStyles.wrap, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={[navIconStyles.label, { color: c.foreground }]}>{item.label}</Text>
                <Text style={[navIconStyles.sub, { color: c.mutedForeground }]}>{item.sub}</Text>
              </Card>
            ))}
          </View>
        </View>

        <View style={{ height: tokens.spacing8 }} />

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Component-level styles ───────────────────────────────────────────────────

const userStatsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing3,
    paddingHorizontal: tokens.spacing4,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 36 },
  num: { fontSize: 18, fontWeight: '800' },
  lbl: { fontSize: 10.5, fontWeight: '500' },
});

const queueStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  pillText: { fontSize: 11, fontWeight: '700' },
  time: { fontSize: 11 },
  question: { fontSize: 13.5, lineHeight: 20, marginBottom: 10 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11.5 },
  actions: { flexDirection: 'row', gap: 6 },
  btn: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
});

const navIconStyles = StyleSheet.create({
  wrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: tokens.spacing5 },
  section: {},
  chipRow: { flexDirection: 'row', gap: tokens.spacing2 },

  // Hero card
  heroCard: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLeft: { flex: 1 },
  heroDate: { fontSize: 11.5, fontWeight: '500', color: '#ffffff99', marginBottom: 3 },
  heroName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff25',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  heroBadgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  heroAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#ffffff30',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: tokens.spacing4,
  },
  heroAvatarText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },

  // Nav grid
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing2,
  },
  navCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: tokens.spacing4,
    paddingHorizontal: tokens.spacing3,
  },
});