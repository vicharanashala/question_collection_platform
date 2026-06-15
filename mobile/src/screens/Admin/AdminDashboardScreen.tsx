import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import type { stackDataItem } from 'gifted-charts-core';

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

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#D97706', bg: '#FEF3C7' },
  ai_review:   { label: 'AI Review',   color: '#7C3AED', bg: '#EDE9FE' },
  human_review:{ label: 'Manual',      color: '#0891B2', bg: '#E0F2FE' },
  approved:    { label: 'Approved',    color: '#059669', bg: '#D1FAE5' },
  rejected:    { label: 'Rejected',    color: '#DC2626', bg: '#FEE2E2' },
};

const CATEGORY_LABELS: Record<string, string> = {
  farmer: 'Farmer', fpo: 'FPO', student: 'Student',
  volunteer: 'Volunteer', ngo: 'NGO',
};

const PIE_COLORS = ['#0891B2', '#7C3AED', '#D97706', '#059669', '#DC2626'];

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

  // ─── Derived chart data ────────────────────────────────────────────────────

  const screenW = Dimensions.get('window').width;
  const chartWidth = screenW - (tokens.spacing5 * 2) - (tokens.spacing4 * 2);
  const maxDaily = Math.max(
    ...(stats?.dailyVolume ?? []).map((d) => d.total),
    5,
  );

  const volumeStackData: stackDataItem[] = (stats?.dailyVolume ?? []).map((d) => ({
    label: shortDate(d.date),
    stacks: [
      { value: d.total,   color: c.primary },
      { value: d.approved, color: '#059669' },
    ],
  }));

  const submittedLineData = (stats?.dailyVolume ?? []).map((d) => ({
    value: d.total,
    label: shortDate(d.date),
  }));

  const approvedLineData2 = (stats?.dailyVolume ?? []).map((d) => ({
    value: d.approved,
    label: shortDate(d.date),
  }));

  const statusPieData = s ? [
    { value: s.pendingQuestions,      label: 'Pending',     color: '#D97706' },
    { value: s.approvedQuestions,     label: 'Approved',    color: '#059669' },
    { value: s.rejectedQuestions,     label: 'Rejected',    color: '#DC2626' },
    { value: Math.max(0, s.totalQuestions - s.approvedQuestions - s.rejectedQuestions - s.pendingQuestions), label: 'AI Review', color: '#7C3AED' },
  ].filter((d) => d.value > 0) : [];

  const stateBarData = (stats?.stateBreakdown ?? []).slice(0, 6).map((r) => ({
    value: r.count,
    label: r.state.length > 8 ? r.state.slice(0, 7) + '…' : r.state,
    frontColor: c.primary,
    topLabelComponent: () => <Text style={[styles.barLabel, { color: c.text }]}>{r.count}</Text>,
  }));

  const categoryPieData = (stats?.categoryBreakdown ?? []).map((r, i) => ({
    value: r.count,
    label: CATEGORY_LABELS[r.category] ?? r.category,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const maxStateCount = stats?.stateBreakdown?.[0]?.count ?? 1;

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

        {/* ── 7-day stacked bar chart ──────────────────────────────────── */}
        {volumeStackData.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: c.surface }]}>
            <View style={styles.chartHead}>
              <Text style={[styles.chartTitle, { color: c.text }]}>Questions — Last 7 Days</Text>
              <View style={styles.chartLegend}>
                <View style={[styles.legendDot, { backgroundColor: c.primary }]} />
                <Text style={[styles.legendText, { color: c.textSecondary }]}>Submitted</Text>
                <View style={[styles.legendDot, { backgroundColor: '#059669', marginLeft: 10 }]} />
                <Text style={[styles.legendText, { color: c.textSecondary }]}>Approved</Text>
              </View>
            </View>
            <BarChart
              stackData={volumeStackData}
              height={140}
              barWidth={26}
              spacing={Math.round((chartWidth - 26) / Math.max(volumeStackData.length, 1))}
              xAxisColor={c.textTertiary + '44'}
              yAxisColor="transparent"
              xAxisLabelTextStyle={{ color: c.textTertiary, fontSize: 10 }}
              yAxisTextStyle={{ color: c.textTertiary, fontSize: 9 }}
              hideRules
              roundedTop
              roundedBottom
              noOfSections={3}
              maxValue={maxDaily * 1.3}
              showXAxisIndices
              pointerConfig={{
                pointerStripColor: 'transparent',
                pointerColor: c.primary,
                radius: 6,
                pointerLabelComponent: (items: any) => {
                  const submitted = items[0]?.value ?? 0;
                  const approved  = items[1]?.value ?? 0;
                  return (
                    <View style={{
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c.textTertiary + '44',
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}>
                      <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700', marginBottom: 3 }}>
                        Submitted  {submitted}
                      </Text>
                      <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700' }}>
                        Approved   {approved}
                      </Text>
                    </View>
                  );
                },
              }}
            />
          </View>
        )}

        {/* ── 7-day side-by-side grouped bars ─────────────────────────────── */}
        {(stats?.dailyVolume ?? []).length > 1 && (
          <View style={[styles.chartCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.chartTitle, { color: c.text }]}>Submitted vs Approved — Last 7 Days</Text>
            <View style={styles.chartLegend}>
              <View style={[styles.legendDot, { backgroundColor: c.primary }]} />
              <Text style={[styles.legendText, { color: c.textSecondary }]}>Submitted</Text>
              <View style={[styles.legendDot, { backgroundColor: '#059669', marginLeft: 10 }]} />
              <Text style={[styles.legendText, { color: c.textSecondary }]}>Approved</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, marginTop: 4 }}>
              {(stats?.dailyVolume ?? []).map((d) => {
                const submittedH = Math.round((d.total / (maxDaily * 1.3)) * 100);
                const approvedH  = Math.round((d.approved / (maxDaily * 1.3)) * 100);
                return (
                  <View key={d.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {/* submitted bar */}
                    <View
                      style={{
                        width: 11,
                        height: Math.max(submittedH, submittedH > 0 ? 4 : 0),
                        backgroundColor: c.primary,
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                      }}
                    />
                    {/* approved bar */}
                    <View
                      style={{
                        width: 11,
                        height: Math.max(approvedH, approvedH > 0 ? 4 : 0),
                        backgroundColor: '#059669',
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                        marginTop: 2,
                      }}
                    />
                    <Text style={{ color: c.textTertiary, fontSize: 9, marginTop: 4 }}>
                      {shortDate(d.date)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Two-column: status pie + state bar ─────────────────────────── */}
        {(statusPieData.length > 0 || stateBarData.length > 0) && (
          <View style={styles.twoCol}>
            {/* Status pie */}
            {statusPieData.length > 0 && (
              <View style={[styles.chartCard, { backgroundColor: c.surface, flex: 1 }]}>
                <Text style={[styles.chartTitle, { color: c.text }]}>Question Status</Text>
                <PieChart
                  data={statusPieData}
                  donut
                  radius={52}
                  innerRadius={32}
                  centerLabelComponent={() => (
                    <Text style={[styles.pieCenter, { color: c.text }]}>
                      {s?.totalQuestions ?? 0}
                    </Text>
                  )}
                />
                <View style={styles.pieLegend}>
                  {statusPieData.map((item) => (
                    <View key={item.label} style={styles.pieLegendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.legendText, { color: c.textSecondary, flex: 1 }]}>{item.label}</Text>
                      <Text style={[styles.legendText, { color: c.text, fontWeight: '600' }]}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* State bar */}
            {stateBarData.length > 0 && (
              <View style={[styles.chartCard, { backgroundColor: c.surface, flex: 1 }]}>
                <Text style={[styles.chartTitle, { color: c.text }]}>Top States</Text>
                <BarChart
                  data={stateBarData}
                  height={110}
                  barWidth={22}
                  spacing={12}
                  roundedTop
                  roundedBottom
                  hideRules
                  xAxisColor={c.textTertiary + '44'}
                  yAxisColor="transparent"
                  xAxisLabelTextStyle={{ color: c.textTertiary, fontSize: 9 }}
                  yAxisTextStyle={{ color: c.textTertiary, fontSize: 9 }}
                  noOfSections={3}
                  maxValue={maxStateCount * 1.2}
                />
              </View>
            )}
          </View>
        )}

        {/* ── User categories pie + Reward summary ───────────────────────── */}
        <View style={styles.twoCol}>
          {categoryPieData.length > 0 && (
            <View style={[styles.chartCard, { backgroundColor: c.surface, flex: 1 }]}>
              <Text style={[styles.chartTitle, { color: c.text }]}>User Categories</Text>
              <PieChart
                data={categoryPieData}
                donut
                radius={46}
                innerRadius={28}
                centerLabelComponent={() => (
                  <Text style={[styles.pieCenter, { color: c.text }]}>
                    {s?.totalUsers ?? 0}
                  </Text>
                )}
              />
              <View style={styles.pieLegend}>
                {categoryPieData.map((item) => (
                  <View key={item.label} style={styles.pieLegendRow}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendText, { color: c.textSecondary, flex: 1 }]}>{item.label}</Text>
                    <Text style={[styles.legendText, { color: c.text, fontWeight: '600' }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Rewards summary */}
          {rewards && (
            <View style={[styles.chartCard, { backgroundColor: c.surface, flex: 1 }]}>
              <Text style={[styles.chartTitle, { color: c.text }]}>Rewards & Payouts</Text>
              <View style={styles.rewardStats}>
                {[
                  { label: 'Total Rewarded', value: formatINR(rewards.totalRewarded), icon: 'wallet', color: c.success },
                  { label: 'Reward Count', value: String(rewards.rewardCount), icon: 'checkmark-done', color: c.primary },
                  { label: 'Avg. Reward', value: formatINR(Math.round(rewards.avgReward)), icon: 'trending-up', color: '#7C3AED' },
                  { label: 'Pending Payouts', value: String(rewards.pendingWithdrawals), icon: 'time', color: rewards.pendingWithdrawals > 0 ? c.warning : c.textSecondary },
                ].map((item) => (
                  <View key={item.label} style={styles.rewardRow}>
                    <Ionicons name={item.icon as any} size={14} color={item.color} />
                    <Text style={[styles.rewardLabel, { color: c.textSecondary }]}>{item.label}</Text>
                    <Text style={[styles.rewardValue, { color: item.color }]}>{item.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
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

        {/* ── State breakdown (list fallback) ───────────────────────────── */}
        {stats?.stateBreakdown && stats.stateBreakdown.length > 0 && stateBarData.length === 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Top States</Text>
            </View>
            {stats.stateBreakdown.slice(0, 6).map((row, i) => (
              <View key={row.state} style={styles.stateRow}>
                <Text style={[styles.stateRank, { color: c.textTertiary }]}>{i + 1}</Text>
                <Text style={[styles.stateName, { color: c.text }]}>{row.state}</Text>
                <View style={styles.barWrap}>
                  <View style={[styles.bar, { width: `${Math.round((row.count / maxStateCount) * 100)}%`, backgroundColor: i === 0 ? c.primary : c.primary + '55' }]} />
                </View>
                <Text style={[styles.stateCount, { color: c.textSecondary }]}>{row.count}</Text>
              </View>
            ))}
          </View>
        )}

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

  // Charts
  twoCol: {
    flexDirection: 'row', gap: tokens.spacing3,
    marginBottom: tokens.spacing3,
  },
  chartCard: {
    borderRadius: tokens.radiusMd, padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  chartHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tokens.spacing3,
  },
  chartTitle: { fontSize: 14, fontWeight: '700', marginBottom: tokens.spacing2 },
  chartLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },

  // Pie
  pieCenter: { fontSize: 16, fontWeight: '800' },
  pieLegend: { marginTop: tokens.spacing2, gap: 4 },
  pieLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Bar
  barLabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },

  // Rewards
  rewardStats: { gap: tokens.spacing2, marginTop: 4 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardLabel: { fontSize: 12, flex: 1 },
  rewardValue: { fontSize: 14, fontWeight: '700' },

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

  // State list fallback
  stateRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: tokens.spacing2, marginBottom: tokens.spacing2,
  },
  stateRank: { width: 16, fontSize: 11, textAlign: 'right' },
  stateName: { width: 90, fontSize: 13 },
  barWrap: { flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3 },
  bar: { height: 6, borderRadius: 3 },
  stateCount: { width: 28, fontSize: 12, textAlign: 'right' },
});