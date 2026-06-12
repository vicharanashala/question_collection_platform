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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { userApi } from '../../api/client';
import { AuthStackParamList, MainTabParamList } from '../../navigation/types';
import { CropDetail } from '../../types';

type ProfileNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<AuthStackParamList>
>;

const categoryLabels: Record<string, string> = {
  farmer: 'Farmer 🌾', fpo: 'FPO Member 🤝', student: 'Student 🎓',
  volunteer: 'Volunteer 🙋', ngo: 'NGO Partner 🏢',
};

const statusColors: Record<string, string> = {
  verified: '#2E7D32',
  pending: '#F57C00',
  manual_review: '#1976D2',
  suspended: '#E53935',
  banned: '#C62828',
};

export function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const navigation = useNavigation<ProfileNavProp>();
  const [crops, setCrops] = useState<CropDetail[]>([]);

  const fetchCrops = useCallback(async () => {
    try {
      const { data } = await userApi.getProfile();
      setCrops(data.crops ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCrops(); }, [fetchCrops]);

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          // AuthProvider state update handles navigation
        },
      },
    ]);
  }

  const verificationLabel = user?.verificationStatus
    ? user.verificationStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
          <Text style={styles.profileCategory}>
            {user?.category ? categoryLabels[user.category] : ''}
          </Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[user?.verificationStatus ?? ''] ?? '#9E9E9E' }]} />
            <Text style={styles.statusText}>{verificationLabel}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Account Details</Text>
          <InfoRow label="Mobile" value={user?.mobileNumber ?? '—'} />
          <InfoRow label="State" value={user?.state ?? '—'} />
          <InfoRow label="District" value={user?.district ?? '—'} />
          {user?.block && <InfoRow label="Block" value={user.block} />}
          <InfoRow label="Language" value={user?.languagePreference ?? '—'} />
          <InfoRow label="Registered On" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
        </View>

        {/* Crops */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Crops</Text>
          {crops.length === 0 ? (
            <Text style={styles.emptyCrops}>No crops added yet</Text>
          ) : (
            <View style={styles.cropTags}>
              {crops.map((crop) => (
                <View key={crop.id} style={styles.cropTag}>
                  <Text style={styles.cropTagText}>{crop.cropName}</Text>
                  {crop.season && <Text style={styles.cropSeason}>({crop.season})</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('EditProfile' as any)}>
            <Text style={styles.actionText}>✏️  Edit Profile</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <Text style={[styles.actionText, { color: '#C62828' }]}>🚪  Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  scroll: { padding: 20 },
  header: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#1B5E20' },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#212121', marginBottom: 4 },
  profileCategory: { fontSize: 14, color: '#558B2F', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#616161' },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#212121', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  infoLabel: { fontSize: 13, color: '#757575' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#424242', textAlign: 'right', flex: 1, marginLeft: 12 },
  cropTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cropTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  cropTagText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  cropSeason: { fontSize: 11, color: '#558B2F', marginLeft: 4 },
  emptyCrops: { fontSize: 13, color: '#9E9E9E' },
  actions: { marginTop: 8 },
  actionRow: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionText: { fontSize: 15, color: '#212121', fontWeight: '600' },
  actionArrow: { fontSize: 20, color: '#BDBDBD' },
});