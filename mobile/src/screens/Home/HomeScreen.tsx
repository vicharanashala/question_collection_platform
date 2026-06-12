import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/client';
import { REWARD_TIERS } from '../../utils/constants';

export function HomeScreen() {
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
    farmer: 'Farmer 🌾', fpo: 'FPO Member 🤝', student: 'Student 🎓',
    volunteer: 'Volunteer 🙋', ngo: 'NGO Partner 🏢',
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2E7D32']} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{user?.name ?? 'User'}</Text>
            <Text style={styles.category}>{user?.category ? categoryLabels[user.category] : ''}</Text>
          </View>
          <TouchableOpacity style={styles.langBadge}>
            <Text style={styles.langText}>{user?.languagePreference ? (langLabels[user.languagePreference] ?? user.languagePreference) : 'EN'}</Text>
          </TouchableOpacity>
        </View>

        {/* State Info */}
        {user?.state && (
          <View style={styles.stateCard}>
            <Text style={styles.stateLabel}>📍 {user.state}{user.district ? ` › ${user.district}` : ''}</Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What would you like to do?</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
              <Text style={styles.actionIcon}>❓</Text>
              <Text style={styles.actionTitle}>Ask a Question</Text>
              <Text style={styles.actionDesc}>Submit agriculture questions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} activeOpacity={0.8}>
              <Text style={styles.actionIcon}>💰</Text>
              <Text style={styles.actionTitle}>View Wallet</Text>
              <Text style={styles.actionDesc}>Check rewards & withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reward Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reward Tiers</Text>
          <Text style={styles.tierNote}>Earn more as you submit approved questions</Text>
          <View style={styles.tierGrid}>
            {REWARD_TIERS.map((tier) => (
              <View key={tier.min} style={styles.tierCard}>
                <Text style={styles.tierRange}>{tier.min}–{tier.max} questions</Text>
                <Text style={styles.tierReward}>₹{tier.reward}/question</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Submission Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guidelines</Text>
          <View style={styles.guidelineCard}>
            <Text style={styles.guidelineItem}>📹 Video: Max 10 seconds, 10 MB</Text>
            <Text style={styles.guidelineItem}>📝 Daily limit: 20 questions</Text>
            <Text style={styles.guidelineItem}>⏱️ Edit window: 30 seconds after submit</Text>
            <Text style={styles.guidelineItem}>🤖 AI relevance check before submission</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { fontSize: 14, color: '#558B2F' },
  name: { fontSize: 24, fontWeight: '800', color: '#1B5E20' },
  category: { fontSize: 13, color: '#757575', marginTop: 4 },
  langBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  langText: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },
  stateCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  stateLabel: { fontSize: 13, color: '#424242' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#212121', marginBottom: 8 },
  tierNote: { fontSize: 12, color: '#757575', marginBottom: 12 },
  actionGrid: { flexDirection: 'row', gap: 12 },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: { fontSize: 36, marginBottom: 10 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#212121', textAlign: 'center' },
  actionDesc: { fontSize: 11, color: '#9E9E9E', textAlign: 'center', marginTop: 4 },
  tierGrid: { gap: 10 },
  tierCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
    marginBottom: 8,
  },
  tierRange: { fontSize: 13, color: '#616161' },
  tierReward: { fontSize: 16, fontWeight: '800', color: '#2E7D32' },
  guidelineCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  guidelineItem: { fontSize: 13, color: '#424242', marginBottom: 8, lineHeight: 18 },
});