import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { REWARD_TIERS, EDIT_WINDOW_SEC, DAILY_QUESTION_LIMIT } from '../../utils/constants';
import { tokens } from '../../utils/theme';

export function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, refreshProfile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function onRefresh() {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }

  const langLabels: Record<string, string> = {
    hi: 'हिन्दी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు', bn: 'বাংলা',
    gu: 'ગુજરાતી', kn: 'ಕನ್ನಡ', ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ', or: 'ଓଡ଼ିଆ',
    as: 'অসমীয়া', ne: 'नेपाली', ur: 'اردو', sa: 'संस्कृत', en: 'English',
  };

  const categoryLabels: Record<string, string> = {
    farmer: 'Farmer', fpo: 'FPO Member', student: 'Student',
    volunteer: 'Volunteer', ngo: 'NGO Partner',
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.primary}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: c.textSecondary }]}>{greeting()},</Text>
            <Text style={[styles.name, { color: c.text }]}>{user?.name ?? 'User'}</Text>
            <View style={[styles.chip, { backgroundColor: c.accent }]}>
              <Text style={[styles.chipText, { color: c.accentForeground }]}>
                {user?.category ? categoryLabels[user.category] : '—'}
              </Text>
            </View>
          </View>
          <View style={[styles.avatar, { backgroundColor: c.primary }]}>
            <Text style={[styles.avatarText, { color: c.primaryForeground }]}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        </View>

        {/* Location */}
        {user?.state && (
          <View style={[styles.locationRow, { backgroundColor: c.surfaceVariant }]}>
            <Text style={[styles.locationText, { color: c.textSecondary }]}>
              📍  {user.state}{user.district ? ` › ${user.district}` : ''}
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            {[
              { icon: '❓', label: 'Ask a Question', sub: 'Submit agricultural queries' },
              { icon: '💰', label: 'View Wallet', sub: 'Rewards & withdrawals' },
            ].map((a) => (
              <TouchableOpacity
                key={a.label}
                style={[styles.actionCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>{a.icon}</Text>
                <Text style={[styles.actionLabel, { color: c.text }]}>{a.label}</Text>
                <Text style={[styles.actionSub, { color: c.textSecondary }]}>{a.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reward Tiers */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Reward Tiers</Text>
            <Text style={[styles.sectionBadge, { color: c.primary }]}>
              Earn per approved question
            </Text>
          </View>
          <View style={[styles.tierTable, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {REWARD_TIERS.map((tier, i) => (
              <View
                key={tier.min}
                style={[
                  styles.tierRow,
                  i < REWARD_TIERS.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.borderSubtle },
                ]}
              >
                <Text style={[styles.tierRange, { color: c.textSecondary }]}>
                  {tier.min}–{tier.max} questions
                </Text>
                <Text style={[styles.tierReward, { color: c.primary }]}>
                  ₹{tier.reward}/question
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Guidelines */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Submission Guidelines</Text>
          <View style={[styles.guideCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
            {[
              `📹 Video — Max ${EDIT_WINDOW_SEC}s duration, 10 MB file size`,
              `📝 Daily limit — Up to ${DAILY_QUESTION_LIMIT} questions per day`,
              `⏱️ Edit window — ${EDIT_WINDOW_SEC} seconds after submission`,
              `🤖 Relevance check — AI validates your question before posting`,
            ].map((item, i) => (
              <View key={i} style={[styles.guideRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: c.borderSubtle }]}>
                <Text style={[styles.guideText, { color: c.textSecondary }]}>{item}</Text>
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
  scroll: { padding: tokens.spacing6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: tokens.spacing4, marginBottom: tokens.spacing4, borderBottomWidth: 1 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 13, letterSpacing: 0.01 * 13 },
  name: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing1, borderRadius: tokens.radiusFull, marginTop: tokens.spacing2 },
  chipText: { fontSize: 12, fontWeight: '600' },
  avatar: { width: 48, height: 48, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', marginLeft: tokens.spacing3 },
  avatarText: { fontSize: 20, fontWeight: '800' },
  locationRow: { borderRadius: tokens.radiusMd, paddingHorizontal: tokens.spacing4, paddingVertical: tokens.spacing3, marginBottom: tokens.spacing6 },
  locationText: { fontSize: 13 },
  section: { marginBottom: tokens.spacing6 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing3 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionBadge: { fontSize: 11, fontWeight: '600', letterSpacing: 0.01 * 11 },
  actionGrid: { flexDirection: 'row', gap: tokens.spacing3 },
  actionCard: { flex: 1, borderRadius: tokens.radiusLg, padding: tokens.spacing4, alignItems: 'center' },
  actionIcon: { fontSize: 32, marginBottom: tokens.spacing2 },
  actionLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actionSub: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  tierTable: { borderRadius: tokens.radiusMd, overflow: 'hidden' },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: tokens.spacing4, paddingVertical: tokens.spacing3 },
  tierRange: { fontSize: 13 },
  tierReward: { fontSize: 15, fontWeight: '800' },
  guideCard: { borderRadius: tokens.radiusMd, overflow: 'hidden' },
  guideRow: { paddingHorizontal: tokens.spacing4, paddingVertical: tokens.spacing3 },
  guideText: { fontSize: 13, lineHeight: 18 },
});