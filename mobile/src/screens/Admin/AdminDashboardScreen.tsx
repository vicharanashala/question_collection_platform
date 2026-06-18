import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { ReasonModal } from '../../components/ReasonModal';
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

// ─── Modern KPI Card ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  gradient,
  icon,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  sub?: string;
  subColor?: string;
}) {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={kpiStyles.card}
    >
      <View style={kpiStyles.topRow}>
        <View style={kpiStyles.iconBox}>
          <Ionicons name={icon} size={16} color="#FFFFFF" />
        </View>
        {sub && (
          <Text style={[kpiStyles.sub, { color: subColor ?? '#FFFFFF99' }]}>{sub}</Text>
        )}
      </View>
      <Text style={kpiStyles.value}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
    </LinearGradient>
  );
}

// ─── Queue item card ──────────────────────────────────────────────────────────

function QueueCard({
  item,
  onApprove,
  onHold,
  onReject,
  onView,
  loading,
  themeColors,
}: {
  item: QueueItem;
  onApprove: () => void;
  onHold: () => void;
  onReject: () => void;
  onView: () => void;
  loading: boolean;
  themeColors: any;
}) {
  const meta = STATUS_META[item.status] ?? {
    label: item.status,
    color: '#6B7280',
    bg: '#F3F4F6',
  };

  return (
    <View style={[queueStyles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={queueStyles.cardHeader}>
        <View style={[queueStyles.pill, { backgroundColor: meta.bg }]}>
          <View style={[queueStyles.dot, { backgroundColor: meta.color }]} />
          <Text style={[queueStyles.pillText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={queueStyles.timeRow}>
          <Ionicons name="time-outline" size={11} color={themeColors.mutedForeground} />
          <Text style={[queueStyles.time, { color: themeColors.mutedForeground }]}>
            {formatDate(item.submittedAt)}
          </Text>
        </View>
      </View>

      <Text style={[queueStyles.question, { color: themeColors.foreground }]} numberOfLines={2}>
        {item.questionText}
      </Text>

      <View style={queueStyles.cardFooter}>
        <View style={queueStyles.metaRow}>
          <Ionicons name="location" size={11} color={themeColors.mutedForeground} />
          <Text style={[queueStyles.metaText, { color: themeColors.mutedForeground }]}>{item.state}</Text>
          <Text style={[queueStyles.metaDot, { color: themeColors.border }]}>·</Text>
          <Ionicons name="person-outline" size={11} color={themeColors.mutedForeground} />
          <Text style={[queueStyles.metaText, { color: themeColors.mutedForeground }]}>
            {item.user.name ?? item.user.mobileNumber}
          </Text>
        </View>

        <View style={queueStyles.actions}>
          <TouchableOpacity
            style={[queueStyles.actionBtn, { backgroundColor: '#05966920' }]}
            onPress={onApprove}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading
              ? <ActivityIndicator size={11} color="#059669" />
              : <Ionicons name="checkmark" size={14} color="#059669" />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[queueStyles.actionBtn, { backgroundColor: '#D9770620' }]}
            onPress={onHold}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Ionicons name="pause" size={14} color="#D97706" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[queueStyles.actionBtn, { backgroundColor: '#DC262620' }]}
            onPress={onReject}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading
              ? <ActivityIndicator size={11} color="#DC2626" />
              : <Ionicons name="close" size={14} color="#DC2626" />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[queueStyles.actionBtn, { backgroundColor: themeColors.primary + '15' }]}
            onPress={onView}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-outline" size={14} color={themeColors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  actionLabel,
  onAction,
  icon,
  themeColors,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  themeColors: any;
}) {
  return (
    <View style={sectionHeaderStyles.row}>
      <View style={sectionHeaderStyles.titleRow}>
        {icon && (
          <View style={[sectionHeaderStyles.iconWrap, { backgroundColor: themeColors.primary + '18' }]}>
            <Ionicons name={icon} size={14} color={themeColors.primary} />
          </View>
        )}
        <Text style={[sectionHeaderStyles.title, { color: themeColors.foreground }]}>{title}</Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity style={sectionHeaderStyles.action} onPress={onAction} activeOpacity={0.6}>
          <Text style={[sectionHeaderStyles.actionText, { color: themeColors.primary }]}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={12} color={themeColors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Quick nav card ───────────────────────────────────────────────────────────

function QuickCard({
  label,
  sub,
  icon,
  color,
  badge,
  onPress,
  themeColors,
}: {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badge?: number;
  onPress: () => void;
  themeColors: any;
}) {
  return (
    <TouchableOpacity
      style={[quickCardStyles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[quickCardStyles.iconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={quickCardStyles.textWrap}>
        <Text style={[quickCardStyles.label, { color: themeColors.foreground }]}>{label}</Text>
        <Text style={[quickCardStyles.sub, { color: themeColors.mutedForeground }]}>{sub}</Text>
      </View>
      {badge != null && badge > 0 && (
        <View style={[quickCardStyles.badge, { backgroundColor: color }]}>
          <Text style={quickCardStyles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider({ color }: { color?: string }) {
  return <View style={[dividerStyles.line, { backgroundColor: color ?? '#E5E7EB' }]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sub: {
    fontSize: 10.5,
    fontWeight: '600',
    textAlign: 'right',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 30,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
});

const queueStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
    ...tokens.shadowSm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  time: { fontSize: 11 },
  question: { fontSize: 14, lineHeight: 21, marginBottom: 12 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 11.5 },
  metaDot: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const sectionHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '700' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionText: { fontSize: 13, fontWeight: '600' },
});

const quickCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing3,
    padding: tokens.spacing4,
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    marginBottom: tokens.spacing2,
    ...tokens.shadowSm,
    position: 'relative',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  sub: { fontSize: 12 },
  badge: {
    position: 'absolute',
    top: -5,
    right: tokens.spacing4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
});

const dividerStyles = StyleSheet.create({
  line: { height: 1, marginVertical: tokens.spacing4 },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboardScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<Nav>();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rewards, setRewards] = useState<RewardSummary | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<'approve' | 'reject' | 'hold' | null>(null);
  const [reasonId, setReasonId] = useState<string | null>(null);

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
      showToast(getErrorMessage(e, 'Failed to load dashboard'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => { fetch(); }, [fetch]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch();
  }

  function openReasonModal(questionId: string, action: 'approve' | 'reject' | 'hold') {
    setReasonId(questionId);
    setReasonAction(action);
  }

  async function handleReasonConfirm(value: string) {
    if (!value.trim() || !reasonAction || !reasonId) return;
    setActionLoading(reasonId);
    try {
      const body: Parameters<typeof adminApi.reviewQuestion>[1] = { action: reasonAction };
      if (reasonAction === 'hold') body.heldReason = value;
      else body.reason = value;
      await adminApi.reviewQuestion(reasonId, body);
      setQueue((prev) => prev.filter((q) => q.id !== reasonId));
      const label = reasonAction === 'approve' ? 'approved' : reasonAction === 'reject' ? 'rejected' : 'placed on hold';
      showToast(`Question ${label}`, 'success');
    } catch (e) {
      showToast(getErrorMessage(e, `Failed to ${reasonAction} question`), 'error');
    } finally {
      setActionLoading(null);
      setReasonAction(null);
      setReasonId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.loadingText, { color: c.mutedForeground }]}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const s = stats?.summary;
  const pendingCount = s?.pendingQuestions ?? 0;
  const approvalRate = s?.approvalRate ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >

        {/* ── Hero header ───────────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: c.heroBg }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={[styles.heroGreeting, { color: c.heroFg + 'bb' }]}>
                {(() => {
                  const h = new Date().getHours();
                  if (h < 12) return 'Good morning';
                  if (h < 17) return 'Good afternoon';
                  return 'Good evening';
                })()},
              </Text>
              <Text style={[styles.heroName, { color: c.heroFg }]}>{user?.name ?? 'Admin'}</Text>
              <View style={[styles.heroRolePill, { backgroundColor: c.heroFg + '22' }]}>
                <Ionicons name="shield-checkmark" size={13} color={c.heroFg} />
                <Text style={[styles.heroRoleText, { color: c.heroFg + 'dd' }]}>Administrator</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.avatarContainer, { backgroundColor: c.heroFg + '33', borderColor: c.heroBg }]}
              onPress={() => navigation.navigate('AdminProfile')}
              activeOpacity={0.7}
            >
              <Text style={[styles.avatarText, { color: c.heroBg }]}>
                {(user?.name ?? 'A').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroBottom}>
            <View style={styles.heroStatPills}>
              <View style={[styles.heroStatPill, { backgroundColor: c.heroFg + '18' }]}>
                <Ionicons name="document-text" size={11} color={c.heroFg + 'cc'} />
                <Text style={[styles.heroStatPillText, { color: c.heroFg + 'cc' }]}>
                  {fmt(s?.totalQuestions ?? 0)} questions
                </Text>
              </View>
              <View style={[styles.heroStatPill, { backgroundColor: c.heroFg + '18' }]}>
                <Ionicons name="people" size={11} color={c.heroFg + 'cc'} />
                <Text style={[styles.heroStatPillText, { color: c.heroFg + 'cc' }]}>
                  {fmt(s?.totalUsers ?? 0)} users
                </Text>
              </View>
              <View style={[styles.heroStatPill, { backgroundColor: c.heroFg + '18' }]}>
                <Ionicons name="checkmark-circle" size={11} color={c.heroFg + 'cc'} />
                <Text style={[styles.heroStatPillText, { color: c.heroFg + 'cc' }]}>
                  {approvalRate}% approved
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Question stats ───────────────────────────────────────────── */}
        <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
          <SectionHeader
            title="Questions"
            icon="document-text"
            actionLabel="All questions"
            onAction={() => navigation.navigate('AdminQuestions')}
            themeColors={c}
          />
          <View style={[styles.statsCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {/* Approval rate bar */}
            <View style={styles.rateBarRow}>
              <View style={styles.rateBarMeta}>
                <Text style={[styles.rateBarLabel, { color: c.mutedForeground }]}>Approval Rate</Text>
                <Text style={[styles.rateBarValue, { color: approvalRate >= 70 ? '#059669' : approvalRate >= 40 ? '#D97706' : '#DC2626' }]}>
                  {approvalRate}%
                </Text>
              </View>
              <View style={[styles.rateBarTrack, { backgroundColor: c.muted }]}>
                <View
                  style={[
                    styles.rateBarFill,
                    {
                      width: `${Math.min(approvalRate, 100)}%`,
                      backgroundColor: approvalRate >= 70 ? '#059669' : approvalRate >= 40 ? '#D97706' : '#DC2626',
                    },
                  ]}
                />
              </View>
            </View>

            <View style={[styles.statsDivider, { backgroundColor: c.border }]} />

            {/* Stat items */}
            <View style={styles.statsGrid}>
              {[
                {
                  label: 'Total',
                  value: fmt(s?.totalQuestions ?? 0),
                  icon: 'layers' as const,
                  color: c.primary,
                  bg: c.primary + '14',
                },
                {
                  label: 'Approved',
                  value: fmt(s?.approvedQuestions ?? 0),
                  icon: 'checkmark-circle' as const,
                  color: '#059669',
                  bg: '#05966914',
                },
                {
                  label: 'Pending',
                  value: String(pendingCount),
                  icon: 'time' as const,
                  color: pendingCount > 10 ? '#DC2626' : pendingCount > 0 ? '#D97706' : '#9CA3AF',
                  bg: (pendingCount > 10 ? '#DC2626' : pendingCount > 0 ? '#D97706' : '#9CA3AF') + '14',
                },
                {
                  label: 'Rejected',
                  value: fmt(s?.rejectedQuestions ?? 0),
                  icon: 'close-circle' as const,
                  color: '#7C3AED',
                  bg: '#7C3AED14',
                },
              ].map((stat) => (
                <View key={stat.label} style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                    <Ionicons name={stat.icon} size={14} color={stat.color} />
                  </View>
                  <Text style={[styles.statValue, { color: c.foreground }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {s && s.flaggedQuestions > 0 && (
              <>
                <View style={[styles.statsDivider, { backgroundColor: c.border }]} />
                <View style={styles.flaggedRow}>
                  <View style={[styles.flaggedDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.flaggedText, { color: '#92400E' }]}>
                    {s.flaggedQuestions} flagged question{s.flaggedQuestions !== 1 ? 's' : ''} need investigation
                  </Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AdminQuestions')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-forward" size={14} color="#D97706" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>

        {/* ── Rewards summary ───────────────────────────────────────────── */}
        {rewards && user?.role !== 'curator' && (
          <View style={[styles.section, { marginTop: tokens.spacing6 }]}>
            <SectionHeader
              title="Rewards & Payouts"
              icon="card"
              themeColors={c}
            />
            <View style={styles.rewardCard}>
              <View style={styles.rewardTopRow}>
                <View style={styles.rewardStat}>
                  <Text style={[styles.rewardValue, { color: '#059669' }]}>
                    {formatINR(rewards.totalRewarded)}
                  </Text>
                  <Text style={[styles.rewardLabel, { color: c.mutedForeground }]}>Total Rewarded</Text>
                  <Text style={[styles.rewardSub, { color: c.mutedForeground }]}>
                    {rewards.rewardCount} rewards · avg {formatINR(Math.round(rewards.avgReward))}
                  </Text>
                </View>
                <View style={[styles.rewardVerticalDivider, { backgroundColor: c.border }]} />
                <View style={styles.rewardStat}>
                  <Text style={[styles.rewardValue, { color: '#D97706' }]}>
                    {formatINR(rewards.totalWithdrawn)}
                  </Text>
                  <Text style={[styles.rewardLabel, { color: c.mutedForeground }]}>Withdrawn</Text>
                  <Text style={[styles.rewardSub, { color: c.mutedForeground }]}>
                    {rewards.withdrawalCount} transactions
                  </Text>
                </View>
              </View>
              {rewards.pendingWithdrawals > 0 && (
                <TouchableOpacity
                  style={[styles.pendingPayoutBtn, { backgroundColor: '#D9770615' }]}
                  onPress={() => navigation.navigate('AdminWithdrawals')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="wallet" size={16} color="#D97706" />
                  <Text style={[styles.pendingPayoutText, { color: '#D97706' }]}>
                    {rewards.pendingWithdrawals} pending payout{rewards.pendingWithdrawals !== 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color="#D97706" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <Divider color={c.border} />

        {/* ── Review queue ──────────────────────────────────────────────── */}
        {queue.length > 0 && (
          <View style={[styles.section, { marginTop: tokens.spacing2 }]}>
            <SectionHeader
              title="Needs Review"
              icon="git-pull-request"
              actionLabel="View all"
              onAction={() => navigation.navigate('AdminQuestions')}
              themeColors={c}
            />
            {queue.map((q) => (
              <QueueCard
                key={q.id}
                item={q}
                onApprove={() => openReasonModal(q.id, 'approve')}
                onHold={() => openReasonModal(q.id, 'hold')}
                onReject={() => openReasonModal(q.id, 'reject')}
                onView={() => navigation.navigate('AdminQuestionDetail', { questionId: q.id })}
                loading={actionLoading === q.id}
                themeColors={c}
              />
            ))}
          </View>
        )}

        <Divider color={c.border} />

        {/* ── Quick access ──────────────────────────────────────────────── */}
        <View style={[styles.section, { marginTop: tokens.spacing2 }]}>
          <SectionHeader title="Quick Access" icon="grid" themeColors={c} />
          <QuickCard
            label="Users"
            sub="Manage accounts"
            icon="people"
            color="#0891B2"
            onPress={() => navigation.navigate('AdminUsers')}
            themeColors={c}
          />
          <QuickCard
            label="Questions"
            sub="Review & moderate"
            icon="document-text"
            color={c.primary}
            badge={pendingCount}
            onPress={() => navigation.navigate('AdminQuestions')}
            themeColors={c}
          />
          {user?.role !== 'curator' && (
            <QuickCard
              label="Withdrawals"
              sub="Approve payouts"
              icon="card"
              color="#D97706"
              onPress={() => navigation.navigate('AdminWithdrawals')}
              themeColors={c}
            />
          )}
          {user?.role === 'super_admin' && (
            <QuickCard
              label="Config"
              sub="System settings"
              icon="settings"
              color="#6B7280"
              onPress={() => navigation.navigate('AdminConfig')}
              themeColors={c}
            />
          )}
        </View>

        <View style={{ height: tokens.spacing8 }} />

      </ScrollView>

      <ReasonModal
        visible={reasonAction !== null}
        title={
          reasonAction === 'approve' ? 'Approve Question' :
          reasonAction === 'reject' ? 'Reject Question' :
          'Hold Question'
        }
        message={
          reasonAction === 'approve' ? 'Enter reason for approval:' :
          reasonAction === 'reject' ? 'Enter reason for rejection:' :
          'Enter reason for holding:'
        }
        confirmLabel={
          reasonAction === 'approve' ? 'Approve' :
          reasonAction === 'reject' ? 'Reject' :
          'Hold'
        }
        loading={actionLoading !== null}
        onConfirm={handleReasonConfirm}
        onClose={() => { setReasonAction(null); setReasonId(null); }}
      />
    </SafeAreaView>
  );
}

// ─── Component-level styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  scroll: { paddingBottom: tokens.spacing4 },

  // Hero
  hero: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing5,
    marginHorizontal: tokens.spacing5,
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLeft: { flex: 1 },
  heroGreeting: {
    fontSize: 12.5,
    fontWeight: '500',
    marginBottom: 2,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 8,
  },
  heroRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  heroRoleText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  heroBottom: {
    marginTop: tokens.spacing4,
  },
  heroStatPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroStatPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: tokens.spacing4,
    flexShrink: 0,
    position: 'relative',
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
  },

  // Sections
  section: { paddingHorizontal: tokens.spacing5 },
  kpiRow: { flexDirection: 'row', gap: tokens.spacing3 },

  // Stats card
  statsCard: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    padding: tokens.spacing4,
    ...tokens.shadowSm,
  },
  rateBarRow: { marginBottom: tokens.spacing4 },
  rateBarMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rateBarLabel: { fontSize: 12, fontWeight: '600' },
  rateBarValue: { fontSize: 20, fontWeight: '800' },
  rateBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rateBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsDivider: { height: 1, marginVertical: tokens.spacing4 },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500' },
  flaggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flaggedDot: { width: 7, height: 7, borderRadius: 3.5 },
  flaggedText: { flex: 1, fontSize: 12.5, fontWeight: '600' },

  // Reward card
  rewardCard: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    borderColor: '#05966930',
    backgroundColor: '#05966908',
    padding: tokens.spacing4,
  },
  rewardTopRow: { flexDirection: 'row', alignItems: 'center' },
  rewardStat: { flex: 1, alignItems: 'center' },
  rewardVerticalDivider: { width: 1, height: 50 },
  rewardValue: { fontSize: 22, fontWeight: '800', marginBottom: 3 },
  rewardLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  rewardSub: { fontSize: 11 },
  pendingPayoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3,
    paddingHorizontal: tokens.spacing4,
    marginTop: tokens.spacing4,
  },
  pendingPayoutText: { flex: 1, fontSize: 13, fontWeight: '700' },
});