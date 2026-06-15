import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { tokens } from '../../utils/theme';

export function AdminProfileScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation();
  const { user, logout } = useAuth();

  const infoRows: Array<{ label: string; value: string; icon: string }> = [
    { label: 'Name',    value: user?.name ?? '—',          icon: 'person' },
    { label: 'Mobile',  value: user?.mobileNumber ?? '—',  icon: 'call' },
    { label: 'Role',    value: user?.role ?? 'admin',      icon: 'shield-checkmark' },
    { label: 'State',   value: user?.state ?? '—',         icon: 'location' },
  ];

  async function handleLogout() {
    await logout();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text }]}>Admin Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={[styles.avatarWrap, { backgroundColor: c.primary + '18' }]}>
          <Text style={[styles.avatarText, { color: c.primary }]}>
            {(user?.name ?? 'A').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: c.text }]}>{user?.name ?? 'Admin'}</Text>
        <Text style={[styles.role, { color: c.textSecondary }]}>
          {user?.role?.replace('_', ' ').toUpperCase() ?? 'ADMIN'}
        </Text>

        {/* Info card */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          {infoRows.map((row, i) => (
            <View key={row.label}>
              <View style={styles.infoRow}>
                <Ionicons name={row.icon as any} size={16} color={c.textTertiary} />
                <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.infoValue, { color: c.text }]}>{row.value}</Text>
              </View>
              {i < infoRows.length - 1 && (
                <View style={[styles.divider, { backgroundColor: c.surfaceVariant }]} />
              )}
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: c.error + '18' }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={18} color={c.error} />
          <Text style={[styles.logoutText, { color: c.error }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: tokens.spacing5, paddingBottom: tokens.spacing3,
  },
  screenTitle: { fontSize: 18, fontWeight: '800' },
  scroll: { padding: tokens.spacing5, alignItems: 'center' },
  avatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: tokens.spacing3,
  },
  avatarText: { fontSize: 32, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  role: { fontSize: 13, fontWeight: '600', letterSpacing: 1, marginBottom: tokens.spacing5 },
  card: {
    width: '100%', borderRadius: tokens.radiusMd,
    padding: tokens.spacing4, marginBottom: tokens.spacing5,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  infoLabel: { fontSize: 13, width: 60 },
  infoValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  divider: { height: 1, marginVertical: tokens.spacing2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing4,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
});