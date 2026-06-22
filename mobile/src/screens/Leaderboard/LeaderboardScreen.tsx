import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { userApi } from "../../api/client";
import { tokens } from "../../utils/theme";
import type { LeaderboardEntry, LeaderboardResponse } from "../../types";

type ThemeColors = ReturnType<typeof useTheme>["theme"]["colors"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MEDALS = {
  gold: {
    color: "#F59E0B",
    bg: "#FEF3C7",
    ring: "#FCD34D",
    glow: "#FBBF24",
    icon: "trophy" as const,
    label: "1st",
  },
  silver: {
    color: "#64748B",
    bg: "#F1F5F9",
    ring: "#CBD5E1",
    glow: "#94A3B8",
    icon: "medal" as const,
    label: "2nd",
  },
  bronze: {
    color: "#B45309",
    bg: "#FEF3C7",
    ring: "#FBBF24",
    glow: "#D97706",
    icon: "medal" as const,
    label: "3rd",
  },
};

function getMedal(medal: "gold" | "silver" | "bronze" | null) {
  return medal ? MEDALS[medal] : null;
}

function formatINR(amount: number) {
  if (amount == null) return "—";
  if (amount <= 0) return "₹0";
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function getInitials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({
  name,
  size = 36,
  ringColor,
  bgColor,
  fgColor,
}: {
  name?: string;
  size?: number;
  ringColor?: string;
  bgColor: string;
  fgColor: string;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          borderWidth: ringColor ? 2 : 0,
          borderColor: ringColor,
        },
      ]}
    >
      <Text
        style={{ color: fgColor, fontWeight: "800", fontSize: size * 0.36 }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ─── Podium (Top 3 hero) ──────────────────────────────────────────────────────

function Podium({ top3, c }: { top3: LeaderboardEntry[]; c: ThemeColors }) {
  if (top3.length === 0) return null;

  // Order: 2nd, 1st, 3rd for visual podium
  const slots = [
    { entry: top3[1], height: 96, key: "silver" as const },
    { entry: top3[0], height: 124, key: "gold" as const },
    { entry: top3[2], height: 80, key: "bronze" as const },
  ].filter((s) => s.entry);

  return (
    <View style={[podStyles.wrap, { backgroundColor: c.surface }]}>
      <View style={podStyles.row}>
        {slots.map(({ entry, height, key }) => {
          const m = MEDALS[key];
          const isWinner = key === "gold";
          return (
            <View key={entry!.userId} style={podStyles.col}>
              <View style={{ alignItems: "center", marginBottom: 10 }}>
                {isWinner && (
                  <Ionicons
                    name="star"
                    size={14}
                    color={m.color}
                    style={{ marginBottom: 4 }}
                  />
                )}
                <Avatar
                  name={entry!.name}
                  size={isWinner ? 56 : 46}
                  ringColor={m.color}
                  bgColor={m.bg}
                  fgColor={m.color}
                />
                <Text
                  style={[
                    podStyles.name,
                    { color: c.text, fontSize: isWinner ? 13 : 12 },
                  ]}
                  numberOfLines={1}
                >
                  {entry!.name || "Unknown"}
                </Text>
                <Text
                  style={[podStyles.earned, { color: c.success }]}
                  numberOfLines={1}
                >
                  {formatINR(entry!.totalEarned)}
                </Text>
              </View>
              <View
                style={[
                  podStyles.pillar,
                  {
                    height,
                    backgroundColor: m.bg,
                    borderColor: m.ring,
                  },
                ]}
              >
                <Ionicons
                  name={m.icon}
                  size={isWinner ? 22 : 18}
                  color={m.color}
                />
                <Text
                  style={[
                    podStyles.rankNum,
                    { color: m.color, fontSize: isWinner ? 22 : 18 },
                  ]}
                >
                  {entry!.rank}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const podStyles = StyleSheet.create({
  wrap: {
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing2,
    paddingHorizontal: tokens.spacing3,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: tokens.spacing2,
  },
  col: { flex: 1, alignItems: "center" },
  name: { fontWeight: "700", marginTop: 8, maxWidth: 96, textAlign: "center" },
  earned: { fontWeight: "800", fontSize: 13, marginTop: 2 },
  pillar: {
    width: "100%",
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: tokens.spacing2,
    gap: 2,
  },
  rankNum: { fontWeight: "900", letterSpacing: -0.5 },
});

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconColor,
  value,
  label,
  c,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string | number;
  label: string;
  c: ThemeColors;
}) {
  return (
    <View
      style={[
        statStyles.card,
        { backgroundColor: c.background, borderColor: c.borderSubtle },
      ]}
    >
      <View style={[statStyles.iconBox, { backgroundColor: iconColor + "18" }]}>
        <Ionicons name={icon} size={13} color={iconColor} />
      </View>
      <View style={{ flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Text style={[statStyles.val, { color: c.text }]} numberOfLines={1}>
          {value}
        </Text>
        <Text
          style={[statStyles.lbl, { color: c.textSecondary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: tokens.radius,
    borderWidth: 1,
    minHeight: 60,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  val: { fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  lbl: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginTop: 3,
  },
});

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, c }: { label: string; c: ThemeColors }) {
  return (
    <View style={slStyles.wrap}>
      <View style={[slStyles.line, { backgroundColor: c.borderSubtle }]} />
      <Text style={[slStyles.text, { color: c.textTertiary }]}>{label}</Text>
      <View style={[slStyles.line, { backgroundColor: c.borderSubtle }]} />
    </View>
  );
}

const slStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing3,
    paddingHorizontal: tokens.spacing4,
    paddingTop: tokens.spacing5,
    paddingBottom: tokens.spacing2,
  },
  line: { flex: 1, height: 1 },
  text: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});

// ─── Your rank card ───────────────────────────────────────────────────────────

function YourRankCard({
  entry,
  c,
}: {
  entry: LeaderboardEntry;
  c: ThemeColors;
}) {
  return (
    <View
      style={[
        yrStyles.wrap,
        {
          backgroundColor: c.primary,
          shadowColor: c.primary,
        },
      ]}
    >
      <View style={yrStyles.rankBox}>
        <Text style={yrStyles.rankLabel}>RANK</Text>
        <Text style={yrStyles.rankNum}>#{entry.rank}</Text>
      </View>

      <View style={yrStyles.divider} />

      <Avatar
        name={entry.name}
        size={40}
        bgColor="rgba(255,255,255,0.2)"
        fgColor="#fff"
      />

      <View style={yrStyles.mid}>
        <Text style={yrStyles.youLabel}>YOUR POSITION</Text>
        <Text style={yrStyles.name} numberOfLines={1}>
          {entry.name || "Unknown"}
        </Text>
      </View>

      <View style={yrStyles.right}>
        <Text style={yrStyles.earnedVal}>{formatINR(entry.totalEarned)}</Text>
        <Text style={yrStyles.qVal}>{entry.totalQuestions} Qs</Text>
      </View>
    </View>
  );
}

const yrStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: tokens.spacing4,
    marginVertical: tokens.spacing2,
    paddingVertical: tokens.spacing3,
    paddingHorizontal: tokens.spacing3,
    borderRadius: tokens.radiusLg,
    gap: tokens.spacing3,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  rankBox: { alignItems: "center", minWidth: 44 },
  rankLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  rankNum: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  divider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.2)" },
  mid: { flex: 1, minWidth: 0 },
  youLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  name: { color: "#fff", fontSize: 15, fontWeight: "700" },
  right: { alignItems: "flex-end" },
  earnedVal: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  qVal: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
});

// ─── List row (rank 4+) ───────────────────────────────────────────────────────

function ListRow({ entry, c }: { entry: LeaderboardEntry; c: ThemeColors }) {
  const isMe = entry.isCurrentUser;
  return (
    <View
      style={[
        rowStyles.row,
        {
          backgroundColor: isMe ? c.primary + "0D" : c.surface,
          borderColor: isMe ? c.primary + "40" : c.borderSubtle + "80",
        },
      ]}
    >
      <Text
        style={[rowStyles.rank, { color: isMe ? c.primary : c.textTertiary }]}
      >
        {entry.rank}
      </Text>

      <Avatar
        name={entry.name}
        size={36}
        bgColor={isMe ? c.primary + "20" : c.muted}
        fgColor={isMe ? c.primary : c.textSecondary}
      />

      <View style={rowStyles.nameCell}>
        <Text
          style={[
            rowStyles.name,
            { color: c.text, fontWeight: isMe ? "800" : "600" },
          ]}
          numberOfLines={1}
        >
          {entry.name || "Unknown"}
        </Text>
        {isMe && (
          <Text style={[rowStyles.youTag, { color: c.primary }]}>You</Text>
        )}
      </View>

      <View style={rowStyles.stats}>
        <Text
          style={[
            rowStyles.earned,
            { color: entry.totalEarned > 0 ? c.success : c.textTertiary },
          ]}
        >
          {formatINR(entry.totalEarned)}
        </Text>
        <Text style={[rowStyles.q, { color: c.textTertiary }]}>
          {entry.totalQuestions > 0 ? `${entry.totalQuestions} Qs` : "—"}
        </Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: tokens.spacing4,
    marginVertical: 4,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing3,
    borderRadius: tokens.radius,
    borderWidth: 1,
    gap: tokens.spacing3,
  },
  rank: { width: 24, fontSize: 14, fontWeight: "800", textAlign: "center" },
  nameCell: { flex: 1, minWidth: 0 },
  name: { fontSize: 14 },
  youTag: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: 1 },
  stats: { alignItems: "flex-end" },
  earned: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  q: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function LeaderboardScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [response, setResponse] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await userApi.getLeaderboard({ limit: 50 });
      setResponse(res.data as LeaderboardResponse);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLeaderboard();
  }, [fetchLeaderboard]);

  const sortedEntries = useMemo(() => {
    if (!response) return [];
    return [...response.entries].sort((a, b) => {
      if (b.totalEarned !== a.totalEarned) return b.totalEarned - a.totalEarned;
      return b.totalQuestions - a.totalQuestions;
    });
  }, [response]);

  const top3 = sortedEntries.slice(0, 3);
  const rest = sortedEntries.slice(3);
  const userEntry = sortedEntries.find((e) => e.isCurrentUser);
  const userInTop3 = top3.some((e) => e.isCurrentUser);
  const userInRest = rest.some((e) => e.isCurrentUser);
  const showUserCard = userEntry && !userInTop3 && !userInRest;

  const totalEarningsAll = sortedEntries.reduce(
    (sum, e) => sum + (e.totalEarned ?? 0),
    0,
  );
  const totalQuestionsAll = sortedEntries.reduce(
    (sum, e) => sum + (e.totalQuestions ?? 0),
    0,
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: c.surface, borderBottomColor: c.borderSubtle },
        ]}
      >
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: c.muted }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>
            Leaderboard
          </Text>
          <Text style={[styles.headerSub, { color: c.textTertiary }]}>
            {response?.total
              ? `${response.total} farmers competing`
              : "Loading…"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.userId}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.primary}
            />
          }
          ListHeaderComponent={
            <>
              {/* Stats row */}
              {response && (
                <View style={styles.statsRow}>
                  <StatCard
                    icon="cash"
                    iconColor="#F59E0B"
                    value={formatINR(totalEarningsAll)}
                    label="Total Rewards"
                    c={c}
                  />
                  <StatCard
                    icon="help-circle"
                    iconColor={c.primary}
                    value={totalQuestionsAll > 0 ? `${totalQuestionsAll}` : "—"}
                    label="Approved Qs"
                    c={c}
                  />
                  <StatCard
                    icon="ribbon"
                    iconColor={c.success}
                    value={response.userRank ? `#${response.userRank}` : "—"}
                    label="Your Rank"
                    c={c}
                  />
                </View>
              )}

              {/* Podium */}
              {top3.length > 0 && <Podium top3={top3} c={c} />}

              {/* Your rank (if outside top 3 AND not in rest list) */}
              {showUserCard && (
                <>
                  <SectionLabel label="Your Position" c={c} />
                  <YourRankCard entry={userEntry!} c={c} />
                </>
              )}

              {/* Rest header */}
              {rest.length > 0 && (
                <SectionLabel label="All Participants" c={c} />
              )}
            </>
          }
          renderItem={({ item }) => <ListRow entry={item} c={c} />}
          ListEmptyComponent={
            top3.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: c.muted }]}>
                  <Ionicons
                    name="trophy-outline"
                    size={36}
                    color={c.textTertiary}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: c.text }]}>
                  No rankings yet
                </Text>
                <Text style={[styles.emptySub, { color: c.textTertiary }]}>
                  Start submitting questions to appear on the leaderboard
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
    gap: tokens.spacing3,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontWeight: "500", marginTop: 1 },

  statsRow: {
    flexDirection: "row",
    gap: tokens.spacing2,
    paddingHorizontal: tokens.spacing4,
    paddingTop: tokens.spacing4,
    paddingBottom: tokens.spacing2,
  },

  listContent: { paddingBottom: tokens.spacing10 },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: tokens.spacing10 * 2,
    gap: tokens.spacing3,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: tokens.spacing2,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: tokens.spacing8,
    lineHeight: 19,
  },
});