import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { AdminStackParamList } from '../../navigation/types';
import { tokens } from '../../utils/theme';

interface FinSummary {
  totalPaidOut: number;
  pendingWithdrawals: { count: number; amount: number };
  completedWithdrawals: { count: number; amount: number };
  failedWithdrawals: { count: number };
  totalWalletBalance: number;
  today: { payoutCount: number; payoutAmount: number };
  dailyPayoutTrend: Array<{ date: string; count: number; amount: number }>;
}

function formatINR(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

function fmtCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, iconColor, bgColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
  iconColor: string;
  bgColor: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.statLabel, { color: c.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: c.foreground }]}>{value}</Text>
      {sub && <Text style={[styles.statSub, { color: c.mutedForeground }]}>{sub}</Text>}
    </View>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: Array<{ date: string; amount: number }> }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const maxAmt = Math.max(...data.map((d) => d.amount), 1);
  const last7 = data.slice(-7);
  return (
    <View style={styles.barChartWrap}>
      {last7.map((d, i) => {
        const h = Math.max((d.amount / maxAmt) * 48, 2);
        const label = d.date.slice(5); // MM-DD
        return (
          <View key={i} style={styles.barCol}>
            <View style={[styles.bar, { height: h, backgroundColor: c.primary }]} />
            <Text style={[styles.barLabel, { color: c.mutedForeground }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function FinanceDashboardScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  const [summary, setSummary] = useState<FinSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await adminApi.getFinancialSummary({ days: 30 });
      setSummary(res.data);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load financial summary'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.headerBar}>
          <Text style={[styles.screenTitle, { color: c.text }]}>Finance Dashboard</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      {/* ── Header ── */}
      <View style={[styles.headerBar, { borderBottomColor: c.border }]}>
        <Text style={[styles.screenTitle, { color: c.text }]}>Finance Dashboard</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        {summary ? (
          <>
            {/* ── Hero header ── */}
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
                  <Text style={[styles.heroName, { color: c.heroFg }]}>{user?.name ?? 'Finance'}</Text>
                  <View style={[styles.heroRolePill, { backgroundColor: c.heroFg + '22' }]}>
                    <Ionicons name="cash" size={13} color={c.heroFg} />
                    <Text style={[styles.heroRoleText, { color: c.heroFg + 'dd' }]}>Finance Team</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.avatarContainer, { backgroundColor: c.heroFg + '33', borderColor: c.heroBg }]}
                  onPress={() => navigation.navigate('FinanceProfile')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.avatarText, { color: c.heroBg }]}>
                    {(user?.name ?? 'F').charAt(0).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.heroBottom}>
                <View style={styles.heroStatPills}>
                  <View style={[styles.heroStatPill, { backgroundColor: c.heroFg + '18' }]}>
                    <Ionicons name="time" size={11} color={c.heroFg + 'cc'} />
                    <Text style={[styles.heroStatPillText, { color: c.heroFg + 'cc' }]}>
                      {summary.pendingWithdrawals.count} pending
                    </Text>
                  </View>
                  <View style={[styles.heroStatPill, { backgroundColor: c.heroFg + '18' }]}>
                    <Ionicons name="checkmark-circle" size={11} color={c.heroFg + 'cc'} />
                    <Text style={[styles.heroStatPillText, { color: c.heroFg + 'cc' }]}>
                      {summary.completedWithdrawals.count} completed
                    </Text>
                  </View>
                  <View style={[styles.heroStatPill, { backgroundColor: c.heroFg + '18' }]}>
                    <Ionicons name="ban" size={11} color={c.heroFg + 'cc'} />
                    <Text style={[styles.heroStatPillText, { color: c.heroFg + 'cc' }]}>
                      {summary.failedWithdrawals.count} failed
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Primary stats ── */}
            <View style={styles.statsGrid}>
              <StatCard
                icon="wallet"
                label="Total Paid Out"
                value={formatINR(summary.totalPaidOut)}
                iconColor="#059669"
                bgColor="#05966918"
              />
              <StatCard
                icon="time"
                label="Pending Withdrawals"
                value={String(summary.pendingWithdrawals.count)}
                sub={formatINR(summary.pendingWithdrawals.amount)}
                iconColor="#D97706"
                bgColor="#D9770618"
              />
              <StatCard
                icon="checkmark-circle"
                label="Completed"
                value={String(summary.completedWithdrawals.count)}
                sub={formatINR(summary.completedWithdrawals.amount)}
                iconColor="#22c55e"
                bgColor="#22c55e18"
              />
              <StatCard
                icon="ban"
                label="Failed"
                value={String(summary.failedWithdrawals.count)}
                iconColor="#ef4444"
                bgColor="#ef444418"
              />
            </View>

            {/* ── Wallet balance ── */}
            <View style={[styles.balanceCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={[styles.balanceIconWrap, { backgroundColor: '#0891B218' }]}>
                <Ionicons name="card" size={18} color="#0891B2" />
              </View>
              <View style={styles.balanceTexts}>
                <Text style={[styles.balanceLabel, { color: c.mutedForeground }]}>Total Wallet Balance</Text>
                <Text style={[styles.balanceValue, { color: '#0891B2' }]}>
                  {formatINR(summary.totalWalletBalance)}
                </Text>
              </View>
            </View>

            {/* ── Today stats ── */}
            <View style={[styles.todayCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.sectionTitle, { color: c.foreground }]}>Today's Payouts</Text>
              <View style={styles.todayRow}>
                <View style={styles.todayCell}>
                  <Text style={[styles.todayValue, { color: c.foreground }]}>
                    {summary.today.payoutCount}
                  </Text>
                  <Text style={[styles.todayLabel, { color: c.mutedForeground }]}>Transactions</Text>
                </View>
                <View style={[styles.todayDivider, { backgroundColor: c.border }]} />
                <View style={styles.todayCell}>
                  <Text style={[styles.todayValue, { color: c.foreground }]}>
                    {formatINR(summary.today.payoutAmount)}
                  </Text>
                  <Text style={[styles.todayLabel, { color: c.mutedForeground }]}>Amount</Text>
                </View>
              </View>
            </View>

            {/* ── Daily trend ── */}
            {summary.dailyPayoutTrend.length > 0 && (
              <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.sectionTitle, { color: c.foreground }]}>
                  Daily Payout Trend (Last 7 days)
                </Text>
                <MiniBarChart data={summary.dailyPayoutTrend} />
                <View style={styles.trendTotal}>
                  <Text style={[styles.trendTotalText, { color: c.mutedForeground }]}>
                    {fmtCount(summary.dailyPayoutTrend.reduce((s, d) => s + d.count, 0))} payouts ·{' '}
                    {formatINR(summary.dailyPayoutTrend.reduce((s, d) => s + d.amount, 0))} total
                  </Text>
                </View>
              </View>
            )}

            {/* ── Quick Access ── */}
            <View style={styles.quickSection}>
              <Text style={[styles.sectionTitle, { color: c.foreground }]}>Quick Access</Text>
              <TouchableOpacity
                style={[styles.quickCard, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => navigation.navigate('FinanceWithdrawals')}
                activeOpacity={0.65}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: '#D9770618' }]}>
                  <Ionicons name="cash" size={20} color="#D97706" />
                </View>
                <View style={styles.quickTexts}>
                  <Text style={[styles.quickLabel, { color: c.foreground }]}>Withdrawals</Text>
                  <Text style={[styles.quickSub, { color: c.mutedForeground }]}>
                    {summary.pendingWithdrawals.count} pending · {formatINR(summary.pendingWithdrawals.amount)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickCard, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => navigation.navigate('FinanceWallets')}
                activeOpacity={0.65}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: '#0891B218' }]}>
                  <Ionicons name="wallet" size={20} color="#0891B2" />
                </View>
                <View style={styles.quickTexts}>
                  <Text style={[styles.quickLabel, { color: c.foreground }]}>Wallets</Text>
                  <Text style={[styles.quickSub, { color: c.mutedForeground }]}>
                    {formatINR(summary.totalWalletBalance)} total balance
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickCard, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => navigation.navigate('FinanceUsers')}
                activeOpacity={0.65}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: '#7C3AED18' }]}>
                  <Ionicons name="people" size={20} color="#7C3AED" />
                </View>
                <View style={styles.quickTexts}>
                  <Text style={[styles.quickLabel, { color: c.foreground }]}>Users</Text>
                  <Text style={[styles.quickSub, { color: c.mutedForeground }]}>
                    View & verify user accounts
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No financial data available</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 18, fontWeight: '700' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: tokens.spacing4 },
  scrollContent: { padding: tokens.spacing4, gap: tokens.spacing3 },

  // Hero
  hero: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing5,
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
    borderWidth: 2,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing3,
  },
  statCard: {
    width: '47%',
    padding: tokens.spacing3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  statLabel: { fontSize: 11, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '700' },
  statSub: { fontSize: 11, marginTop: 2 },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing4,
    borderRadius: 12,
    borderWidth: 1,
  },
  balanceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing3,
  },
  balanceTexts: { flex: 1 },
  balanceLabel: { fontSize: 12, marginBottom: 2 },
  balanceValue: { fontSize: 22, fontWeight: '800' },
  todayCard: {
    padding: tokens.spacing4,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: tokens.spacing3 },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayCell: { flex: 1, alignItems: 'center' },
  todayDivider: { width: 1, height: 36 },
  todayValue: { fontSize: 22, fontWeight: '700' },
  todayLabel: { fontSize: 11, marginTop: 2 },
  chartCard: {
    padding: tokens.spacing4,
    borderRadius: 12,
    borderWidth: 1,
  },
  barChartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 56,
    marginBottom: tokens.spacing2,
  },
  barCol: { alignItems: 'center', gap: 4 },
  bar: { width: 24, borderRadius: 4 },
  barLabel: { fontSize: 9 },
  trendTotal: { alignItems: 'center' },
  trendTotalText: { fontSize: 11 },
  emptyWrap: { padding: tokens.spacing8, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  quickSection: { marginTop: tokens.spacing2 },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing3,
    padding: tokens.spacing4,
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    marginBottom: tokens.spacing2,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  quickTexts: { flex: 1 },
  quickLabel: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  quickSub: { fontSize: 12 },
});