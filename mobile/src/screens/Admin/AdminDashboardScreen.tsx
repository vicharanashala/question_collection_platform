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

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#D97706', bg: '#FEF3C7' },
  ai_review:   { label: 'AI Review',   color: '#7C3AED', bg: '#EDE9FE' },
  human_review:{ label: 'Manual',      color: '#0891B2', bg: '#E0F2FE' },
  approved:    { label: 'Approved',    color: '#059669', bg: '#D1FAE5' },
  rejected:    { label: 'Rejected',    color: '#DC2626', bg: '#FEE2E2' },
};

// ─── Component ────────────────────────────────────────────────────────────────

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
      // Load combined review queue (pending + human_review) for quick actions
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
      setStats((prev) => prev ? {
        ...prev,
        summary: {
          ...prev.summary,
          totalQuestions: prev.summary.totalQuestions + 1,
          approvedQuestions: prev.summary.approvedQuestions + 1,
          pendingQuestions: Math.max(0, prev.summary.pendingQuestions - 1),
          approvalRate: Math.round(((prev.summary.approvedQuestions + 1) / (prev.summary.totalQuestions + 1)) * 100),
        },
      } : prev);
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
      setStats((prev) => prev ? {
        ...prev,
        summary: {
          ...prev.summary,
          rejectedQuestions: prev.summary.rejectedQuestions + 1,
          pendingQuestions: Math.max(0, prev.summary.pendingQuestions - 1),
        },
      } : prev);
    } catch (e) {
      console.warn('[AdminDashboard] quick reject error:', getErrorMessage(e, ''));
    } finally {
      setActionLoading(null);
    }
  }

  const s = stats?.summary ?? null;
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >

        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: c.textSecondary }]}>{today}</Text>
            <Text style={[styles.adminName, { color: c.text }]}>{user?.name ?? 'Admin'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.avatarCircle, { backgroundColor: c.primary + '18' }]}
            onPress={() => navigation.navigate('AdminProfile')}
            activeOpacity={0.7}
          >
            <Text style={[styles.avatarText, { color: c.primary }]}>
              {(user?.name ?? 'A').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Alert banner ──────────────────────────────────────────────── */}
        {(s?.pendingQuestions ?? 0) > 0 || (rewards?.pendingWithdrawals ?? 0) > 0 ? (
          <View style={[styles.alertBanner, { backgroundColor: c.warning + '18' }]}>
            <Ionicons name="warning" size={16} color={c.warning} />
            <Text style={[styles.alertText, { color: c.warning }]}>
              {[
                s?.pendingQuestions ? `${s.pendingQuestions} questions pending review` : null,
                rewards?.pendingWithdrawals ? `${rewards.pendingWithdrawals} payouts awaiting approval` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}

        {/* ── KPI row 1 ─────────────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          {[
            { label: 'Total Questions', value: (s?.totalQuestions ?? 0).toLocaleString('en-IN'), icon: 'chatbubbles', color: '#0891B2', iconBg: '#0891B618' },
            { label: 'Approved', value: (s?.approvedQuestions ?? 0).toLocaleString('en-IN'), icon: 'checkmark-circle', color: '#059669', iconBg: '#05966918' },
          ].map((item) => (
            <View key={item.label} style={[styles.kpiCard, { backgroundColor: c.surface }]}>
              <View style={[styles.kpiIconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={[styles.kpiValue, { color: item.color }]}>{item.value}</Text>
              <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
          <View style={[styles.kpiCard, { backgroundColor: c.surface }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: (s?.pendingQuestions ?? 0) > 10 ? c.warning + '18' : c.success + '18' }]}>
              <Ionicons name="time" size={18} color={(s?.pendingQuestions ?? 0) > 10 ? c.warning : c.success} />
            </View>
            <Text style={[styles.kpiValue, { color: (s?.pendingQuestions ?? 0) > 10 ? c.warning : c.success }]}>{s?.pendingQuestions ?? 0}</Text>
            <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Pending</Text>
          </View>
        </View>

        {/* ── KPI row 2 ─────────────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: c.surface }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: c.primary + '18' }]}>
              <Ionicons name="people" size={18} color={c.primary} />
            </View>
            <Text style={[styles.kpiValue, { color: c.primary }]}>{s ? (s.totalUsers > 999 ? `${(s.totalUsers / 1000).toFixed(1)}k` : s.totalUsers) : '—'}</Text>
            <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Total Users</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: c.surface }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#7C3AED18' }]}>
              <Ionicons name="checkmark-done" size={18} color="#7C3AED" />
            </View>
            <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>{s?.approvalRate ?? 0}%</Text>
            <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Approval Rate</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: c.surface }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#DC262618' }]}>
              <Ionicons name="flag" size={18} color="#DC2626" />
            </View>
            <Text style={[styles.kpiValue, { color: '#DC2626' }]}>{s?.flaggedQuestions ?? 0}</Text>
            <Text style={[styles.kpiLabel, { color: c.textSecondary }]}>Flagged</Text>
          </View>
        </View>

        {/* ── Quick review queue ─────────────────────────────────────────── */}
        {queue.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Needs Review</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AdminQuestions')}>
                <Text style={[styles.seeAll, { color: c.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {queue.map((q) => {
              const meta = STATUS_META[q.status] ?? { label: q.status, color: c.textSecondary, bg: c.surfaceVariant };
              return (
                <View key={q.id} style={[styles.reviewCard, { backgroundColor: c.surface }]}>
                  <View style={styles.reviewCardTop}>
                    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    <Text style={[styles.reviewTime, { color: c.textTertiary }]}>{formatDate(q.submittedAt)}</Text>
                  </View>
                  <Text style={[styles.reviewQuestion, { color: c.text }]} numberOfLines={2}>{q.questionText}</Text>
                  <View style={styles.reviewCardBot}>
                    <Text style={[styles.reviewMeta, { color: c.textTertiary }]}>
                      {q.state} · {(q.user?.mobileNumber ?? '').slice(-4).padStart((q.user?.mobileNumber ?? '').length, '*')}
                    </Text>
                    <View style={styles.reviewActions}>
                      <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: c.success + '18' }]}
                        onPress={() => quickApprove(q.id)}
                        disabled={actionLoading === q.id}
                      >
                        {actionLoading === q.id
                          ? <ActivityIndicator size={12} color={c.success} />
                          : <Ionicons name="checkmark" size={14} color={c.success} />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: c.error + '18' }]}
                        onPress={() => quickReject(q.id)}
                        disabled={actionLoading === q.id}
                      >
                        {actionLoading === q.id
                          ? <ActivityIndicator size={12} color={c.error} />
                          : <Ionicons name="close" size={14} color={c.error} />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: c.primary + '18' }]}
                        onPress={() => navigation.navigate('AdminQuestionDetail', { questionId: q.id })}
                      >
                        <Ionicons name="chevron-forward" size={14} color={c.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Quick-nav grid ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Management</Text>
          <View style={styles.quickNavGrid}>
            {[
              { label: 'Users',       sub: 'Manage & moderate',      icon: 'people',         screen: 'AdminUsers',       color: '#0891B2' },
              { label: 'Questions',   sub: 'Full review queue',       icon: 'document-text',  screen: 'AdminQuestions',   color: c.primary },
              { label: 'Withdrawals', sub: `${rewards?.pendingWithdrawals ?? 0} pending`, icon: 'cash', screen: 'AdminWithdrawals', color: c.warning },
              { label: 'Config',      sub: 'System settings',         icon: 'settings',       screen: 'AdminConfig',      color: '#6B7280' },
            ].map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={[styles.quickNavCard, { backgroundColor: c.surface }]}
                onPress={() => navigation.navigate(item.screen as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.qnIconWrap, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.qnText}>
                  <Text style={[styles.qnLabel, { color: c.text }]}>{item.label}</Text>
                  <Text style={[styles.qnSub, { color: c.textTertiary }]}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: tokens.spacing5 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tokens.spacing5,
  },
  greeting: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  adminName: { fontSize: 22, fontWeight: '800' },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 9999,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800' },

  // Alert
  alertBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: tokens.radiusMd, padding: tokens.spacing3,
    marginBottom: tokens.spacing5, gap: tokens.spacing2,
  },
  alertText: { fontSize: 13, fontWeight: '600', flex: 1 },

  // KPI
  kpiRow: {
    flexDirection: 'row', gap: tokens.spacing2,
    marginBottom: tokens.spacing3,
  },
  kpiCard: {
    flex: 1, borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
  },
  kpiIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  kpiValue: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  kpiLabel: { fontSize: 10, marginTop: 2 },

  // Sections
  section: { marginBottom: tokens.spacing6 },
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tokens.spacing3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },

  // Review queue
  reviewCard: {
    borderRadius: tokens.radiusMd, padding: tokens.spacing3,
    marginBottom: tokens.spacing2, gap: tokens.spacing2,
  },
  reviewCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  reviewTime: { fontSize: 10 },
  reviewQuestion: { fontSize: 13, lineHeight: 18 },
  reviewCardBot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewMeta: { fontSize: 11 },
  reviewActions: { flexDirection: 'row', gap: tokens.spacing2 },
  quickBtn: {
    width: 28, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },

  // Quick nav
  quickNavGrid: { gap: tokens.spacing2 },
  quickNavCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: tokens.radiusMd, padding: tokens.spacing3, gap: tokens.spacing3,
  },
  qnIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  qnText: { flex: 1 },
  qnLabel: { fontSize: 14, fontWeight: '700' },
  qnSub: { fontSize: 11, marginTop: 1 },
});