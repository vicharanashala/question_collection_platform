import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { auditApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActorStats {
  actorId: string;
  actorName: string;
  actorRole: string;
  withdrawalApproved: number;
  withdrawalRejected: number;
  withdrawalProcessed: number;
  withdrawalRetried: number;
  userSuspended: number;
  userBanned: number;
  userUnsuspended: number;
  userUnbanned: number;
  userVerified: number;
  questionApproved: number;
  questionRejected: number;
  questionHeld: number;
  configUpdated: number;
  totalActions: number;
}

interface SummaryPoint {
  date: string;
  withdrawals: number;
  userActions: number;
  questionReviews: number;
  configChanges: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function KpiCard({
  label,
  value,
  gradient,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  sub?: string;
}) {
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={kpiStyles.card}>
      <View style={kpiStyles.topRow}>
        <View style={kpiStyles.iconBox}>
          <Ionicons name={icon} size={14} color="#FFFFFF" />
        </View>
        {sub && <Text style={kpiStyles.sub}>{sub}</Text>}
      </View>
      <Text style={kpiStyles.value}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
    </LinearGradient>
  );
}

function SectionHeader({ title, icon, themeColors }: { title: string; icon: keyof typeof Ionicons.glyphMap; themeColors: any }) {
  return (
    <View style={sectionHeaderStyles.row}>
      <View style={sectionHeaderStyles.titleRow}>
        <View style={[sectionHeaderStyles.iconWrap, { backgroundColor: themeColors.primary + '18' }]}>
          <Ionicons name={icon} size={13} color={themeColors.primary} />
        </View>
        <Text style={[sectionHeaderStyles.title, { color: themeColors.foreground }]}>{title}</Text>
      </View>
    </View>
  );
}


function ActorRow({ actor, themeColors }: { actor: ActorStats; themeColors: any }) {
  return (
    <View style={[arStyles.row, { borderBottomColor: themeColors.border }]}>
      <View style={arStyles.avatar}>
        <Text style={arStyles.avatarText}>
          {(actor.actorName ?? actor.actorId).charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={arStyles.info}>
        <Text style={[arStyles.name, { color: themeColors.foreground }]}>
          {actor.actorName ?? actor.actorId}
        </Text>
        <Text style={[arStyles.role, { color: themeColors.mutedForeground }]}>
          {actor.actorRole}
        </Text>
      </View>
      <View style={arStyles.stats}>
        <View style={[arStyles.statChip, { backgroundColor: '#05966918' }]}>
          <Text style={[arStyles.statVal, { color: '#059669' }]}>{actor.questionApproved}</Text>
          <Text style={[arStyles.statLbl, { color: '#05966988' }]}>AP</Text>
        </View>
        <View style={[arStyles.statChip, { backgroundColor: '#dc262618' }]}>
          <Text style={[arStyles.statVal, { color: '#dc2626' }]}>{actor.questionRejected}</Text>
          <Text style={[arStyles.statLbl, { color: '#dc262688' }]}>RJ</Text>
        </View>
        <View style={[arStyles.statChip, { backgroundColor: themeColors.primary + '15' }]}>
          <Text style={[arStyles.statVal, { color: themeColors.primary }]}>{actor.totalActions}</Text>
          <Text style={[arStyles.statLbl, { color: themeColors.primary + '88' }]}>TOT</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    minHeight: 105,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  sub: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  value: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', lineHeight: 28 },
  label: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
});

const sectionHeaderStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spacing3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 24, height: 24, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700' },
});

const arStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3,
    paddingVertical: tokens.spacing3, borderBottomWidth: 1,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0891b230', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#0891b2' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  role: { fontSize: 11, textTransform: 'capitalize' },
  stats: { flexDirection: 'row', gap: 4 },
  statChip: {
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    alignItems: 'center',
  },
  statVal: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
  statLbl: { fontSize: 9, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function AdminSuperAdminScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const { showToast } = useToast();

  const [actorStats, setActorStats] = useState<{ actors: ActorStats[]; summary: { totalActions: number; uniqueActors: number } } | null>(null);
  const [summary, setSummary] = useState<{ series: SummaryPoint[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [statsRes, summaryRes] = await Promise.all([
        auditApi.getActorStats({}),
        auditApi.getSummary({ granularity: 'day' }),
      ]);
      setActorStats(statsRes.data);
      setSummary(summaryRes.data);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load super admin data'), 'error');
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

  const actors = actorStats?.actors ?? [];
  const topActors = actors.slice(0, 5);
  const totalActions = actorStats?.summary?.totalActions ?? 0;
  const uniqueActors = actorStats?.summary?.uniqueActors ?? 0;

  // Recent activity from the time series (last 7 days)
  const recentSeries = summary?.series?.slice(-7) ?? [];
  const maxDayTotal = Math.max(...recentSeries.map((d) => d.total), 1);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.loadingText, { color: c.mutedForeground }]}>Loading…</Text>
        </View>
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
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: c.heroBg }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={[styles.heroGreeting, { color: c.heroFg + 'bb' }]}>
                {(() => {
                  const h = new Date().getHours();
                  if (h < 12) return 'Good morning';
                  if (h < 17) return 'Good afternoon';
                  return 'Good evening';
                })()}
              </Text>
              <Text style={[styles.heroName, { color: c.heroFg }]}>{user?.name ?? 'Super Admin'}</Text>
              <View style={[styles.heroRolePill, { backgroundColor: c.heroFg + '22' }]}>
                <Ionicons name="shield" size={13} color={c.heroFg} />
                <Text style={[styles.heroRoleText, { color: c.heroFg + 'dd' }]}>Super Administrator</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Global KPIs */}
        <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
          <SectionHeader title="Activity Overview" icon="analytics" themeColors={c} />
          <View style={styles.kpiRow}>
            <KpiCard
              label="Total Actions"
              value={fmtNum(totalActions)}
              gradient={['#4f46e5', '#7c3aed']}
              icon="flash"
              sub="All time"
            />
            <KpiCard
              label="Active Admins"
              value={String(uniqueActors)}
              gradient={['#0891b2', '#0e7490']}
              icon="people"
              sub="Last 30 days"
            />
          </View>
          <View style={styles.kpiRow}>
            <KpiCard
              label="Config Changes"
              value={fmtNum(actors.reduce((s, a) => s + a.configUpdated, 0))}
              gradient={['#6b7280', '#4b5563']}
              icon="settings"
            />
            <KpiCard
              label="Users Banned"
              value={fmtNum(actors.reduce((s, a) => s + a.userBanned, 0))}
              gradient={['#dc2626', '#991b1b']}
              icon="person-remove"
            />
          </View>
        </View>

        {/* Activity chart (simple bar representation) */}
        {recentSeries.length > 0 && (
          <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
            <SectionHeader title="Daily Activity (Last 7 Days)" icon="bar-chart" themeColors={c} />
            <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={chartStyles.bars}>
                {recentSeries.map((day) => {
                  const pct = (day.total / maxDayTotal) * 100;
                  const label = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
                  return (
                    <View key={day.date} style={chartStyles.barCol}>
                      <Text style={[chartStyles.barVal, { color: c.mutedForeground }]}>
                        {fmtNum(day.total)}
                      </Text>
                      <View style={chartStyles.barTrack}>
                        <View
                          style={[
                            chartStyles.barFill,
                            { height: `${Math.max(pct, 2)}%`, backgroundColor: c.primary },
                          ]}
                        />
                      </View>
                      <Text style={[chartStyles.barLbl, { color: c.mutedForeground }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
              {/* Legend */}
              <View style={chartStyles.legend}>
                {[
                  { color: '#059669', label: 'Withdrawals' },
                  { color: '#0891b2', label: 'User Actions' },
                  { color: '#7c3aed', label: 'Question Reviews' },
                  { color: '#6b7280', label: 'Config' },
                ].map((l) => (
                  <View key={l.label} style={chartStyles.legendItem}>
                    <View style={[chartStyles.legendDot, { backgroundColor: l.color }]} />
                    <Text style={[chartStyles.legendText, { color: c.mutedForeground }]}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Top performers */}
        {topActors.length > 0 && (
          <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
            <SectionHeader title="Admin Leaderboard" icon="trophy" themeColors={c} />
            <View style={[styles.leaderboard, { backgroundColor: c.card, borderColor: c.border }]}>
              {topActors.map((actor, idx) => (
                <ActorRow key={actor.actorId} actor={actor} themeColors={c} />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: tokens.spacing8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const chartStyles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: tokens.spacing2,
    paddingBottom: tokens.spacing2,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barVal: { fontSize: 9, fontWeight: '600' },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 3,
  },
  barLbl: { fontSize: 10, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing3,
    marginTop: tokens.spacing3,
    paddingTop: tokens.spacing3,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing3 },
  loadingText: { fontSize: 14 },
  scroll: { paddingBottom: tokens.spacing8 },
  hero: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: tokens.spacing5,
    paddingBottom: tokens.spacing6,
    paddingHorizontal: tokens.spacing5,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { gap: 4 },
  heroGreeting: { fontSize: 13 },
  heroName: { fontSize: 24, fontWeight: '800' },
  heroRolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginTop: 4,
  },
  heroRoleText: { fontSize: 12, fontWeight: '700' },
  section: { paddingHorizontal: tokens.spacing5 },
  kpiRow: { flexDirection: 'row', gap: tokens.spacing3, marginBottom: tokens.spacing3 },
  chartCard: {
    borderRadius: tokens.radiusLg, borderWidth: 1,
    padding: tokens.spacing4, ...tokens.shadowSm,
  },
  leaderboard: {
    borderRadius: tokens.radiusLg, borderWidth: 1,
    padding: tokens.spacing4, ...tokens.shadowSm,
  },
});