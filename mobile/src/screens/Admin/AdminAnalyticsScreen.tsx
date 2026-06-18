/**
 * AdminAnalyticsScreen — Task 11
 *
 * Dedicated analytics screen for admin users on mobile.
 * Fetches from the four dedicated analytics endpoints (dashboard, users,
 * questions, rewards) and renders KPI cards + simple SVG bar charts.
 *
 * Routes:
 *   GET /analytics/dashboard   → AnalyticsDashboard
 *   GET /analytics/users       → UserAnalytics
 *   GET /analytics/questions   → QuestionAnalytics
 *   GET /analytics/rewards     → RewardAnalytics
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Svg, { Rect, G, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { analyticsApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import type {
  AnalyticsDashboard,
  UserAnalytics,
  QuestionAnalytics,
  RewardAnalytics,
  TimeRange,
} from '../../types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatINR(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${n}`;
}

// ─── Mini Horizontal Bar Chart (SVG) ─────────────────────────────────────────

interface BarDatum {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  maxValue?: number;
  barColor?: string;
  height?: number;
}

function BarChart({ data, maxValue, barColor = '#0d9488', height = 160 }: BarChartProps) {
  if (data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>No data</Text>
      </View>
    );
  }
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const BAR_H = 20;
  const LABEL_W = 72;
  const BAR_W_AVAIL = Dimensions.get('window').width - 48 - LABEL_W - 48;
  const GAP = 6;
  const svgH = Math.min(data.length * (BAR_H + GAP), height);
  const viewH = Math.max(svgH, height);

  return (
    <Svg
      height={viewH}
      width={Dimensions.get('window').width - 48}
    >
      {data.map((d, i) => {
        const barW = Math.max(4, Math.round((d.value / max) * BAR_W_AVAIL));
        const y = i * (BAR_H + GAP);
        return (
          <G key={d.label}>
            {/* Label */}
            <SvgText
              x={0}
              y={y + BAR_H / 2 + 4}
              fontSize={10}
              fill="#6b7280"
              fontFamily="System"
            >
              {d.label.length > 10 ? d.label.slice(0, 10) + '…' : d.label}
            </SvgText>
            {/* Bar background */}
            <Rect
              x={LABEL_W}
              y={y}
              width={BAR_W_AVAIL}
              height={BAR_H}
              rx={4}
              fill="#f3f4f6"
            />
            {/* Bar fill */}
            <Rect
              x={LABEL_W}
              y={y}
              width={barW}
              height={BAR_H}
              rx={4}
              fill={d.color ?? barColor}
            />
            {/* Value label */}
            <SvgText
              x={LABEL_W + barW + 4}
              y={y + BAR_H / 2 + 4}
              fontSize={10}
              fill="#374151"
              fontFamily="System"
              fontWeight="600"
            >
              {fmtNum(d.value)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Daily Volume Bars (SVG) ──────────────────────────────────────────────────

interface VolumeDatum {
  date: string;
  submitted: number;
  approved: number;
  rejected: number;
}

interface VolumeChartProps {
  data: VolumeDatum[];
  height?: number;
}

function VolumeChart({ data, height = 120 }: VolumeChartProps) {
  if (data.length === 0) {
    return (
      <View style={{ height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>No volume data</Text>
      </View>
    );
  }
  const max = Math.max(...data.map((d) => d.submitted), 1);
  const W = Dimensions.get('window').width - 48;
  const BAR_W = Math.max(4, Math.round((W - 8) / data.length) - 2);
  const CHART_H = height - 20;

  return (
    <View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#0d9488' }} />
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Submitted</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#22c55e' }} />
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Approved</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#ef4444' }} />
          <Text style={{ fontSize: 10, color: '#6b7280' }}>Rejected</Text>
        </View>
      </View>
      <Svg height={CHART_H + 18} width={W}>
        {data.map((d, i) => {
          const submittedH = Math.max(2, Math.round((d.submitted / max) * CHART_H));
          const approvedH = Math.max(2, Math.round((d.approved / max) * CHART_H));
          const rejectedH = Math.max(2, Math.round((d.rejected / max) * CHART_H));
          const x = i * (BAR_W + 2) + 1;
          const baseY = CHART_H; // bars grow upward from bottom
          const stack = [
            { h: submittedH - approvedH - rejectedH, color: '#0d9488' },
            { h: approvedH, color: '#22c55e' },
            { h: rejectedH, color: '#ef4444' },
          ];
          let y = baseY;
          return (
            <G key={d.date}>
              {stack.map((s, si) => {
                const ry = y - s.h;
                y = ry;
                return <Rect key={si} x={x} y={ry} width={BAR_W} height={Math.max(2, s.h)} fill={s.color} rx={2} />;
              })}
              <SvgText
                x={x + BAR_W / 2}
                y={CHART_H + 14}
                fontSize={8}
                fill="#9ca3af"
                textAnchor="middle"
              >
                {d.date.slice(-5)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── Period selector ──────────────────────────────────────────────────────────

const PERIODS: { value: TimeRange; label: string; days: number }[] = [
  { value: '7d',  label: '7D',  days: 7 },
  { value: '30d', label: '30D', days: 30 },
  { value: '90d', label: '90D', days: 90 },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
}

function KpiCard({ label, value, sub, color }: KpiCardProps) {
  return (
    <View style={[kpiStyles.card, { borderLeftColor: color }]}>
      <Text style={kpiStyles.value}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
      {sub && <Text style={kpiStyles.sub}>{sub}</Text>}
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 10,
    minWidth: 100,
  },
  value: { fontSize: 20, fontWeight: '800', color: '#111827' },
  label: { fontSize: 10.5, fontWeight: '600', color: '#6b7280', marginTop: 2 },
  sub: { fontSize: 10, color: '#9ca3af', marginTop: 1 },
});

// ─── Section Card ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: { label: string; onPress: () => void };
}

function SectionCard({ title, subtitle, children, action }: SectionCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[cardStyles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={cardStyles.header}>
        <View>
          <Text style={[cardStyles.title, { color: c.foreground }]}>{title}</Text>
          {subtitle && <Text style={[cardStyles.subtitle, { color: c.mutedForeground }]}>{subtitle}</Text>}
        </View>
        {action && (
          <TouchableOpacity onPress={action.onPress} activeOpacity={0.6}>
            <Text style={[cardStyles.action, { color: c.primary }]}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    padding: tokens.spacing4,
    ...tokens.shadowXs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 11, marginTop: 2 },
  action: { fontSize: 12, fontWeight: '600' },
});

// ─── Loading state ────────────────────────────────────────────────────────────

function LoadingFallback() {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#0d9488" />
    </SafeAreaView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function AdminAnalyticsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<Nav>();

  const [period, setPeriod] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [users, setUsers] = useState<UserAnalytics | null>(null);
  const [questions, setQuestions] = useState<QuestionAnalytics | null>(null);
  const [rewards, setRewards] = useState<RewardAnalytics | null>(null);

  const fetch_ = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const params = { timeRange: period };

    try {
      const [dash, usr, q, rw] = await Promise.all([
        analyticsApi.getDashboard(params).then((r) => r.data).catch(() => null),
        analyticsApi.getUserAnalytics(params).then((r) => r.data).catch(() => null),
        analyticsApi.getQuestionAnalytics(params).then((r) => r.data).catch(() => null),
        analyticsApi.getRewardAnalytics(params).then((r) => r.data).catch(() => null),
      ]);
      setDashboard(dash);
      setUsers(usr);
      setQuestions(q);
      setRewards(rw);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load analytics'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function onRefresh() {
    await fetch_(true);
  }

  if (loading) return <LoadingFallback />;

  const q = questions;
  const u = users;
  const r = rewards;
  const d = dashboard;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: c.foreground }]}>Analytics</Text>
            <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
              Platform insights
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.profileBtn, { backgroundColor: c.primary + '15' }]}
            onPress={() => navigation.navigate('AdminProfile')}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={18} color={c.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Period selector ──────────────────────────────────────────── */}
        <View style={[styles.periodRow, { backgroundColor: c.card, borderColor: c.border }]}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[
                styles.periodBtn,
                period === p.value && { backgroundColor: c.primary },
              ]}
              onPress={() => setPeriod(p.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.periodText,
                  { color: period === p.value ? '#fff' : c.mutedForeground },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
            <Ionicons name="warning-outline" size={14} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Primary KPI row ───────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="Total Users"
            value={fmtNum(d?.totalRegisteredUsers ?? u?.totalUsers ?? 0)}
            sub={`${fmtNum(d?.monthlyActiveUsers ?? u?.mau ?? 0)} MAU`}
            color="#0891b2"
          />
          <KpiCard
            label="Approved Questions"
            value={fmtNum(d?.totalApprovedQuestions ?? q?.summary.total ?? 0)}
            sub={`${q?.summary.approvalRate ?? 0}% approval`}
            color="#059669"
          />
        </View>

        <View style={[styles.kpiRow, { marginTop: tokens.spacing2 }]}>
          <KpiCard
            label="Total Rewarded"
            value={formatINR(d?.totalRewarded ?? r?.totalRewarded ?? 0)}
            sub={`${r?.rewardCount ?? 0} rewards`}
            color="#7c3aed"
          />
          <KpiCard
            label="Dataset Growth"
            value={`${d?.datasetGrowthRate ?? q?.summary.growthRate ?? 0}%`}
            sub={`₹${(d?.costPerApprovedQuestion ?? 0).toFixed(0)}/question`}
            color="#d97706"
          />
        </View>

        <View style={[styles.kpiRow, { marginTop: tokens.spacing2 }]}>
          <KpiCard
            label="States Covered"
            value={`${d?.stateParticipationRate ?? 0}%`}
            sub={`${u?.totalUsers ?? 0} total users`}
            color="#0891b2"
          />
          <KpiCard
            label="Avg AI Confidence"
            value={d?.avgQuestionQualityScore != null ? `${d.avgQuestionQualityScore}%` : '—'}
            sub={`${q?.avgAiConfidence != null ? `${q.avgAiConfidence}%` : '—'} model score`}
            color="#059669"
          />
        </View>

        {/* ── Daily Question Volume ─────────────────────────────────────── */}
        {q && (
          <View style={{ marginTop: tokens.spacing4 }}>
            <SectionCard
              title="Daily Question Volume"
              subtitle={`${PERIODS.find((p) => p.value === period)?.days ?? 30} days`}
            >
              <VolumeChart data={q.dailyVolume} height={120} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNum}>{fmtNum(q.summary.total)}</Text>
                  <Text style={styles.summaryLbl}>Total</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: '#059669' }]}>
                    {fmtNum(q.summary.approved)}
                  </Text>
                  <Text style={styles.summaryLbl}>Approved</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: '#ef4444' }]}>
                    {fmtNum(q.summary.rejected)}
                  </Text>
                  <Text style={styles.summaryLbl}>Rejected</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNum, { color: '#d97706' }]}>
                    {fmtNum(q.summary.pending)}
                  </Text>
                  <Text style={styles.summaryLbl}>Pending</Text>
                </View>
              </View>
            </SectionCard>
          </View>
        )}

        {/* ── State Breakdown ───────────────────────────────────────────── */}
        {q && q.stateBreakdown.length > 0 && (
          <View style={{ marginTop: tokens.spacing4 }}>
            <SectionCard
              title="Questions by State"
              subtitle="Top 8 states"
            >
              <BarChart
                data={q.stateBreakdown.slice(0, 8).map((s) => ({
                  label: s.state,
                  value: s.count,
                }))}
                barColor="#0d9488"
              />
            </SectionCard>
          </View>
        )}

        {/* ── Crop Breakdown ────────────────────────────────────────────── */}
        {q && q.cropBreakdown.length > 0 && (
          <View style={{ marginTop: tokens.spacing4 }}>
            <SectionCard
              title="Questions by Crop"
              subtitle="Top crops"
            >
              <BarChart
                data={q.cropBreakdown.slice(0, 7).map((c) => ({
                  label: c.cropType,
                  value: c.count,
                  color: '#7c3aed',
                }))}
                barColor="#7c3aed"
              />
            </SectionCard>
          </View>
        )}

        {/* ── User State Breakdown ──────────────────────────────────────── */}
        {u && u.stateBreakdown.length > 0 && (
          <View style={{ marginTop: tokens.spacing4 }}>
            <SectionCard
              title="Users by State"
              subtitle="Top states"
            >
              <BarChart
                data={u.stateBreakdown.slice(0, 8).map((s) => ({
                  label: s.state,
                  value: s.count,
                  color: '#0891b2',
                }))}
                barColor="#0891b2"
              />
            </SectionCard>
          </View>
        )}

        {/* ── Rewards & Payouts ─────────────────────────────────────────── */}
        {r && (
          <View style={{ marginTop: tokens.spacing4 }}>
            <SectionCard title="Rewards & Payouts" subtitle="Current period">
              <View style={styles.kpiRow}>
                <KpiCard
                  label="Total Rewarded"
                  value={formatINR(r.totalRewarded)}
                  sub={`${r.rewardCount} transactions`}
                  color="#059669"
                />
                <KpiCard
                  label="Avg. Reward"
                  value={formatINR(Math.round(r.avgReward))}
                  color="#7c3aed"
                />
              </View>
              <View style={[styles.kpiRow, { marginTop: tokens.spacing2 }]}>
                <KpiCard
                  label="Withdrawn"
                  value={formatINR(r.withdrawals.totalWithdrawn)}
                  sub={`${r.withdrawals.completed} completed`}
                  color="#d97706"
                />
                <KpiCard
                  label="Pending Payouts"
                  value={String(r.withdrawals.pending)}
                  sub={`${r.withdrawals.failed} failed`}
                  color={r.withdrawals.pending > 0 ? '#dc2626' : '#9ca3af'}
                />
              </View>
            </SectionCard>
          </View>
        )}

        <View style={{ height: tokens.spacing8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    padding: tokens.spacing5,
    paddingTop: tokens.spacing4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing4,
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    padding: 3,
    marginBottom: tokens.spacing4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: tokens.radius,
    alignItems: 'center',
  },
  periodText: { fontSize: 13, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: tokens.radius,
    borderWidth: 1,
    marginBottom: tokens.spacing4,
  },
  errorText: { fontSize: 12, color: '#dc2626', flex: 1 },
  kpiRow: { flexDirection: 'row', gap: tokens.spacing2 },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 17, fontWeight: '800', color: '#111827' },
  summaryLbl: { fontSize: 10.5, color: '#9ca3af', marginTop: 2 },
});