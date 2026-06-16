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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accentColor,
  bgColor,
  onPress,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  accentColor: string;
  bgColor: string;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[statStyles.card, { backgroundColor: bgColor }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[statStyles.iconWrap, { backgroundColor: accentColor + '20' }]}>
        <Ionicons name={icon as any} size={20} color={accentColor} />
      </View>
      <Text style={[statStyles.value, { color: accentColor }]}>{value}</Text>
      <Text style={statStyles.title}>{title}</Text>
      {subtitle && <Text style={statStyles.subtitle}>{subtitle}</Text>}
    </Wrapper>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Text style={[sectionStyles.label, { color: c.textTertiary }]}>{children}</Text>
  );
}

// ─── Styles for sub-components ────────────────────────────────────────────────

const statStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    flex: 1,
    gap: 6,
    ...tokens.shadowSm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  subtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
});

const sectionStyles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: tokens.spacing3,
    marginLeft: 2,
  },
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  const pendingCount = s?.pendingQuestions ?? 0;
  const approvalRate = s?.approvalRate ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: c.textSecondary }]}>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            <Text style={[styles.adminName, { color: c.text }]}>
              {user?.name ?? "Admin"}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.avatarCircle, { backgroundColor: c.primary }]}
            onPress={() => navigation.navigate("AdminProfile")}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>
              {(user?.name ?? "A").charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Alert strip ───────────────────────────────────────────────── */}
        {pendingCount > 0 || (rewards?.pendingWithdrawals ?? 0) > 0 ? (
          <View
            style={[
              styles.alertStrip,
              {
                backgroundColor: c.warning + "15",
                borderColor: c.warning + "30",
              },
            ]}
          >
            <View
              style={[
                styles.alertIconWrap,
                { backgroundColor: c.warning + "20" },
              ]}
            >
              <Ionicons name="warning" size={13} color={c.warning} />
            </View>
            <Text style={[styles.alertText, { color: c.warning }]}>
              {[
                pendingCount > 0
                  ? `${pendingCount} question${pendingCount > 1 ? "s" : ""} need review`
                  : null,
                rewards?.pendingWithdrawals
                  ? `${rewards.pendingWithdrawals} payout${rewards.pendingWithdrawals > 1 ? "s" : ""} pending`
                  : null,
              ]
                .filter(Boolean)
                .join("   ·   ")}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={c.warning} />
          </View>
        ) : null}

        {/* ── Question Stats ────────────────────────────────────────────── */}
        <SectionLabel>Question Overview</SectionLabel>
        <View style={styles.statsGrid}>
          <StatCard
            title="Total"
            value={(s?.totalQuestions ?? 0).toLocaleString("en-IN")}
            icon="chatbubbles"
            accentColor="#0891B2"
            bgColor={c.surface}
            onPress={() => navigation.navigate("AdminQuestions")}
          />
          <StatCard
            title="Approved"
            value={(s?.approvedQuestions ?? 0).toLocaleString("en-IN")}
            subtitle={`${approvalRate}% acceptance`}
            icon="checkmark-circle"
            accentColor="#059669"
            bgColor={c.surface}
          />
        </View>
        <View style={[styles.statsGrid, { marginTop: tokens.spacing3 }]}>
          <StatCard
            title="Pending Review"
            value={String(pendingCount)}
            subtitle={pendingCount > 10 ? "High load" : "Under control"}
            icon="time"
            accentColor={pendingCount > 10 ? "#D97706" : "#7C3AED"}
            bgColor={c.surface}
            onPress={() => navigation.navigate("AdminQuestions")}
          />
          <StatCard
            title="Rejected"
            value={(s?.rejectedQuestions ?? 0).toLocaleString("en-IN")}
            icon="close-circle"
            accentColor="#DC2626"
            bgColor={c.surface}
          />
        </View>

        {/* ── User Stats ────────────────────────────────────────────────── */}
        <View style={[styles.statsGrid, { marginTop: tokens.spacing5 }]}>
          <StatCard
            title="Total Users"
            value={
              s && s.totalUsers > 999
                ? `${(s.totalUsers / 1000).toFixed(1)}k`
                : String(s?.totalUsers ?? "—")
            }
            icon="people"
            accentColor={c.primary}
            bgColor={c.surface}
            onPress={() => navigation.navigate("AdminUsers")}
          />
          <StatCard
            title="Flagged"
            value={String(s?.flaggedQuestions ?? 0)}
            icon="flag"
            accentColor="#DC2626"
            bgColor={c.surface}
          />
        </View>

        {/* ── Rewards summary ───────────────────────────────────────────── */}
        {rewards && (
          <View style={[styles.section, { marginTop: tokens.spacing6 }]}>
            <SectionLabel>Rewards</SectionLabel>
            <View style={styles.statsGrid}>
              <StatCard
                title="Total Rewarded"
                value={formatINR(rewards.totalRewarded)}
                icon="wallet"
                accentColor="#059669"
                bgColor={c.surface}
              />
              <StatCard
                title="Avg. Reward"
                value={formatINR(Math.round(rewards.avgReward))}
                icon="trending-up"
                accentColor="#7C3AED"
                bgColor={c.surface}
              />
            </View>
            <View style={[styles.statsGrid, { marginTop: tokens.spacing3 }]}>
              <StatCard
                title="Withdrawals"
                value={formatINR(rewards.totalWithdrawn)}
                subtitle={`${rewards.withdrawalCount} transactions`}
                icon="cash"
                accentColor="#D97706"
                bgColor={c.surface}
              />
              <StatCard
                title="Pending Payouts"
                value={String(rewards.pendingWithdrawals)}
                icon="hourglass"
                accentColor={
                  rewards.pendingWithdrawals > 0 ? c.warning : "#9CA3AF"
                }
                bgColor={c.surface}
                onPress={
                  rewards.pendingWithdrawals > 0
                    ? () => navigation.navigate("AdminWithdrawals")
                    : undefined
                }
              />
            </View>
          </View>
        )}

        {/* ── Review queue ──────────────────────────────────────────────── */}
        {queue.length > 0 && (
          <View style={[styles.section, { marginTop: tokens.spacing6 }]}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                Needs Review
              </Text>
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() => navigation.navigate("AdminQuestions")}
                activeOpacity={0.7}
              >
                <Text style={[styles.seeAll, { color: c.primary }]}>
                  View all
                </Text>
                <Ionicons name="chevron-forward" size={13} color={c.primary} />
              </TouchableOpacity>
            </View>

            {queue.map((q) => {
              const meta = STATUS_META[q.status] ?? {
                label: q.status,
                color: c.textSecondary,
                bg: c.surfaceVariant,
              };
              const isLoading = actionLoading === q.id;
              return (
                <View
                  key={q.id}
                  style={[
                    queueStyles.card,
                    { backgroundColor: c.surface, borderColor: c.border },
                  ]}
                >
                  <View style={queueStyles.cardTop}>
                    <View
                      style={[queueStyles.pill, { backgroundColor: meta.bg }]}
                    >
                      <View
                        style={[
                          queueStyles.pillDot,
                          { backgroundColor: meta.color },
                        ]}
                      />
                      <Text
                        style={[queueStyles.pillText, { color: meta.color }]}
                      >
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={[queueStyles.time, { color: c.textTertiary }]}>
                      {formatDate(q.submittedAt)}
                    </Text>
                  </View>

                  <Text
                    style={[queueStyles.question, { color: c.text }]}
                    numberOfLines={2}
                  >
                    {q.questionText}
                  </Text>

                  <View style={queueStyles.cardBot}>
                    <View style={queueStyles.metaWrap}>
                      <Ionicons
                        name="location-outline"
                        size={11}
                        color={c.textTertiary}
                      />
                      <Text
                        style={[queueStyles.meta, { color: c.textTertiary }]}
                      >
                        {q.state}
                        {q.user?.mobileNumber
                          ? `  ·  ${q.user.mobileNumber.slice(-4).padStart(q.user.mobileNumber.length, "*")}`
                          : ""}
                      </Text>
                    </View>
                    <View style={queueStyles.actions}>
                      <TouchableOpacity
                        style={[
                          queueStyles.actionBtn,
                          { backgroundColor: "#05966915" },
                        ]}
                        onPress={() => quickApprove(q.id)}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        {isLoading ? (
                          <ActivityIndicator size={12} color="#059669" />
                        ) : (
                          <Ionicons
                            name="checkmark"
                            size={15}
                            color="#059669"
                          />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          queueStyles.actionBtn,
                          { backgroundColor: "#DC262615" },
                        ]}
                        onPress={() => quickReject(q.id)}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        {isLoading ? (
                          <ActivityIndicator size={12} color="#DC2626" />
                        ) : (
                          <Ionicons name="close" size={15} color="#DC2626" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          queueStyles.actionBtn,
                          { backgroundColor: c.primary + "15" },
                        ]}
                        onPress={() =>
                          navigation.navigate("AdminQuestionDetail", {
                            questionId: q.id,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={15}
                          color={c.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Quick-nav cards ───────────────────────────────────────────── */}
        <View style={[styles.section, { marginTop: tokens.spacing6 }]}>
          <SectionLabel>Quick Access</SectionLabel>
          <View style={navStyles.grid}>
            {[
              {
                label: "Users",
                sub: "Manage & moderate",
                icon: "people",
                screen: "AdminUsers",
                accent: "#0891B2",
              },
              {
                label: "Questions",
                sub: "Review & moderate",
                icon: "document-text",
                screen: "AdminQuestions",
                accent: c.primary,
              },
              {
                label: "Withdrawals",
                sub: "Approve payouts",
                icon: "card",
                screen: "AdminWithdrawals",
                accent: "#D97706",
              },
              {
                label: "Config",
                sub: "System settings",
                icon: "settings",
                screen: "AdminConfig",
                accent: "#6B7280",
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={[
                  navStyles.card,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
                onPress={() => navigation.navigate(item.screen as any)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    navStyles.iconWrap,
                    { backgroundColor: item.accent + "18" },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={item.accent}
                  />
                </View>
                <View style={navStyles.textWrap}>
                  <Text style={[navStyles.label, { color: c.text }]}>
                    {item.label}
                  </Text>
                  <Text style={[navStyles.sub, { color: c.textTertiary }]}>
                    {item.sub}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={c.textTertiary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: tokens.spacing10 }} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing4,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  adminName: { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  avatarCircle: {
    width: 50, height: 50, borderRadius: 9999,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: tokens.spacing4,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Alert
  alertStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: tokens.spacing3,
    marginBottom: tokens.spacing5,
  },
  alertText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  alertIconWrap: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: tokens.spacing3,
  },

  // Sections
  section: {},
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing3,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});

// Queue card styles
const queueStyles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing2,
    ...tokens.shadowSm,
  },
  cardTop: {
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
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  pillText: { fontSize: 11, fontWeight: '700' },
  time: { fontSize: 11 },
  question: { fontSize: 13.5, lineHeight: 20, marginBottom: 10 },
  cardBot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: { fontSize: 12 },
  metaWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 9,
    justifyContent: 'center', alignItems: 'center',
  },
});

// Quick nav styles
const navStyles = StyleSheet.create({
  grid: { gap: tokens.spacing3 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    padding: tokens.spacing4,
    gap: tokens.spacing3,
    ...tokens.shadowSm,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  textWrap: { flex: 1 },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: 12 },
});