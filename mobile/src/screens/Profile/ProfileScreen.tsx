import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { CropDetail } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  verified: '#22C55E',
  pending: '#F59E0B',
  manual_review: '#3B82F6',
  suspended: '#EF4444',
  banned: '#991B1B',
};

export function ProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, logout, refreshProfile } = useAuth();
  const navigation = useNavigation<any>();
  const [crops, setCrops] = useState<CropDetail[]>([]);

  const fetchCrops = useCallback(async () => {
    try {
      const { data } = await userApi.getProfile();
      setCrops(data.crops ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCrops(); }, [fetchCrops]);

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => { await logout(); },
      },
    ]);
  }

  const verificationLabel = user?.verificationStatus
    ? user.verificationStatus.replace(/_/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase())
    : 'Unknown';

  const categoryLabels: Record<string, string> = {
    farmer: 'Farmer', fpo: 'FPO Member', student: 'Student',
    volunteer: 'Volunteer', ngo: 'NGO Partner',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Profile</Text>
        </View>

        {/* Identity Card */}
        <View style={[styles.profileCard, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
          <View style={[styles.avatar, { backgroundColor: c.primary }]}>
            <Text style={[styles.avatarText, { color: c.primaryForeground }]}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: c.text }]}>{user?.name ?? '—'}</Text>
          <Text style={[styles.profileCategory, { color: c.textSecondary }]}>
            {user?.category ? categoryLabels[user.category] : ''}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: STATUS_COLORS[user?.verificationStatus ?? ''] ?? c.textTertiary },
              ]}
            />
            <Text style={[styles.statusText, { color: c.textSecondary }]}>{verificationLabel}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.detailsCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Account Details</Text>
          <DetailsRow label="Mobile" value={user?.mobileNumber ?? '—'} theme={theme} />
          <DetailsRow label="State" value={user?.state ?? '—'} theme={theme} />
          <DetailsRow label="District" value={user?.district ?? '—'} theme={theme} />
          {user?.block && <DetailsRow label="Block" value={user.block} theme={theme} />}
          <DetailsRow label="Language" value={user?.languagePreference ?? '—'} theme={theme} />
          <DetailsRow
            label="Registered"
            value={
              user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })
                : '—'
            }
            theme={theme}
          />
        </View>

        {/* Crops */}
        <View style={[styles.detailsCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Crops</Text>
          {crops.length === 0 ? (
            <Text style={[styles.emptyText, { color: c.textTertiary }]}>No crops added yet</Text>
          ) : (
            <View style={styles.cropTags}>
              {crops.map((crop) => (
                <View key={crop.id} style={[styles.cropTag, { backgroundColor: c.accent }]}>
                  <Text style={[styles.cropTagText, { color: c.accentForeground }]}>{crop.cropName}</Text>
                  {crop.season && (
                    <Text style={[styles.cropSeason, { color: c.textSecondary }]}>  ({crop.season})</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: c.surface, ...tokens.shadowSm }]}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={[styles.actionText, { color: c.text }]}>Edit Profile</Text>
            <Text style={[styles.actionArrow, { color: c.textTertiary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: c.surface, ...tokens.shadowSm }]}
            onPress={handleLogout}
          >
            <Text style={[styles.actionText, { color: c.error }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailsRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.colors.borderSubtle }]}>
      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: tokens.spacing6 },
  header: { marginBottom: tokens.spacing4 },
  title: { fontSize: 26, fontWeight: '800' },
  profileCard: { borderRadius: tokens.radiusXl, padding: tokens.spacing6, alignItems: 'center', marginBottom: tokens.spacing4 },
  avatar: { width: 72, height: 72, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing3 },
  avatarText: { fontSize: 30, fontWeight: '800' },
  profileName: { fontSize: 22, fontWeight: '800', marginBottom: tokens.spacing1 },
  profileCategory: { fontSize: 14, marginBottom: tokens.spacing2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  statusDot: { width: 8, height: 8, borderRadius: tokens.radiusFull },
  statusText: { fontSize: 12 },
  detailsCard: { borderRadius: tokens.radiusLg, padding: tokens.spacing4, marginBottom: tokens.spacing3 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: tokens.spacing3 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: tokens.spacing3, borderBottomWidth: 1 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: tokens.spacing3 },
  cropTags: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  cropTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing1 + 2, borderRadius: tokens.radiusFull },
  cropTagText: { fontSize: 13, fontWeight: '600' },
  cropSeason: { fontSize: 11 },
  emptyText: { fontSize: 13 },
  actions: { marginTop: tokens.spacing2 },
  actionRow: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  actionText: { fontSize: 15, fontWeight: '600' },
  actionArrow: { fontSize: 20 },
});