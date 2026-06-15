import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';

type Route = RouteProp<AdminStackParamList, 'AdminUserDetail'>;

export function AdminUserDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const route = useRoute<Route>();
  const { userId } = route.params;

  const [data, setData] = useState<{ user: Record<string, unknown>; questions: Record<string, unknown>[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    adminApi.getUserDetail(userId)
      .then((r) => setData(r.data))
      .catch((e) => showToast(getErrorMessage(e, 'Failed to load user'), 'error'))
      .finally(() => setLoading(false));
  }, [userId]);

  async function handleSuspendBan(action: 'suspend' | 'ban') {
    Alert.prompt(
      `${action === 'ban' ? 'Ban' : 'Suspend'} User`,
      'Reason (optional):',
      async (reason) => {
        setActionLoading(true);
        try {
          await adminApi.suspendUser(userId, { action, reason: reason ?? undefined });
          showToast(`User ${action === 'ban' ? 'banned' : 'suspended'}`, 'success');
          nav.goBack();
        } catch (e: unknown) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
          showToast(msg ?? `Failed to ${action}`, 'error');
        } finally {
          setActionLoading(false);
        }
      },
      'plain-text',
    );
  }

  async function handleVerifyUser() {
    setActionLoading(true);
    try {
      await adminApi.verifyUser(userId);
      showToast('User verified successfully', 'success');
      // Refresh user data
      const r = await adminApi.getUserDetail(userId);
      setData(r.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Failed to verify user', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><Text style={{ color: c.text }}>User not found</Text></View>
      </SafeAreaView>
    );
  }

  const { user, questions } = data;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>User Detail</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* User info */}
        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.name, { color: c.text }]}>{String(user.name || user.mobileNumber)}</Text>
          <Text style={[styles.meta, { color: c.textSecondary }]}>{String(user.mobileNumber)}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: c.primary + '22' }]}>
              <Text style={[styles.badgeText, { color: c.primary }]}>{String(user.role)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: c.warning + '22' }]}>
              <Text style={[styles.badgeText, { color: c.warning }]}>{String(user.verificationStatus)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: c.textTertiary + '22' }]}>
              <Text style={[styles.badgeText, { color: c.textSecondary }]}>{String(user.category)}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Location</Text>
          <Text style={[styles.value, { color: c.text }]}>
            {String(user.district ?? '')}, {String(user.state ?? '')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>Account</Text>
          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: c.textSecondary }]}>Language</Text>
              <Text style={[styles.metaVal, { color: c.text }]}>{String(user.languagePreference)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: c.textSecondary }]}>Joined</Text>
              <Text style={[styles.metaVal, { color: c.text }]}>
                {user.createdAt ? new Date(String(user.createdAt)).toLocaleDateString('en-IN') : 'N/A'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: c.textSecondary }]}>Last Login</Text>
              <Text style={[styles.metaVal, { color: c.text }]}>
                {user.lastLoginAt ? new Date(String(user.lastLoginAt)).toLocaleDateString('en-IN') : 'Never'}
              </Text>
            </View>
          </View>
        </View>

        {/* Verify action — all admins, for pending users only */}
        {user.verificationStatus === 'pending' && (
          <View style={[styles.verifyZone, { borderColor: c.success + '44' }]}>
            <Text style={[styles.verifyTitle, { color: c.success }]}>Verification</Text>
            <Text style={[styles.verifyDesc, { color: c.textSecondary }]}>
              This user has completed registration but is awaiting verification.
            </Text>
            <TouchableOpacity
              style={[styles.verifyBtn, { backgroundColor: c.success }]}
              onPress={handleVerifyUser}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.verifyBtnText}>Verify User</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Danger zone — super admins only */}
        {isSuperAdmin && user.role !== 'super_admin' && (
          <View style={[styles.dangerZone, { borderColor: c.error + '44' }]}>
            <Text style={[styles.dangerTitle, { color: c.error }]}>Admin Actions</Text>
            <View style={styles.dangerActions}>
              <TouchableOpacity
                style={[styles.dangerBtn, { borderColor: c.warning }]}
                onPress={() => handleSuspendBan('suspend')}
                disabled={actionLoading}
              >
                {actionLoading
                  ? <ActivityIndicator size="small" color={c.warning} />
                  : <Text style={[styles.dangerBtnText, { color: c.warning }]}>Suspend</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, { borderColor: c.error }]}
                onPress={() => handleSuspendBan('ban')}
                disabled={actionLoading}
              >
                <Text style={[styles.dangerBtnText, { color: c.error }]}>Ban</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Recent questions */}
        <Text style={[styles.sectionTitle, { color: c.text }]}>Recent Questions ({questions.length})</Text>
        {questions.length === 0 ? (
          <Text style={[styles.empty, { color: c.textTertiary }]}>No questions submitted</Text>
        ) : (
          questions.map((q) => (
            <View key={String(q.id)} style={[styles.questionCard, { backgroundColor: c.surface }]}>
              <View style={styles.questionTop}>
                <Text style={[styles.questionText, { color: c.text }]} numberOfLines={2}>
                  {String(q.questionText)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(String(q.status)) + '22' }]}>
                  <Text style={[styles.statusText, { color: statusColor(String(q.status)) }]}>
                    {String(q.status)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.questionDate, { color: c.textTertiary }]}>
                {q.submittedAt ? new Date(String(q.submittedAt)).toLocaleDateString('en-IN') : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', ai_review: '#8b5cf6', human_review: '#ec4899',
  approved: '#22c55e', rejected: '#ef4444',
};
function statusColor(s: string) { return STATUS_COLORS[s] ?? '#6b7280'; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: tokens.spacing5, paddingBottom: tokens.spacing3 },
  scroll: { padding: tokens.spacing5 },
  screenTitle: { fontSize: 22, fontWeight: '800', flex: 1 },
  section: { borderRadius: tokens.radiusMd, padding: tokens.spacing4, marginBottom: tokens.spacing3 },
  name: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  meta: { fontSize: 13, marginBottom: tokens.spacing3 },
  badgeRow: { flexDirection: 'row', gap: tokens.spacing2, flexWrap: 'wrap' },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: tokens.spacing1 },
  value: { fontSize: 14 },
  metaGrid: { gap: tokens.spacing2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaKey: { fontSize: 13 },
  metaVal: { fontSize: 13, fontWeight: '600' },
  verifyZone: { borderRadius: tokens.radiusMd, padding: tokens.spacing4, borderWidth: 1, marginBottom: tokens.spacing4 },
  verifyTitle: { fontSize: 13, fontWeight: '700', marginBottom: tokens.spacing1 },
  verifyDesc: { fontSize: 13, lineHeight: 18, marginBottom: tokens.spacing3 },
  verifyBtn: { borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing3, alignItems: 'center' },
  verifyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dangerZone: { borderRadius: tokens.radiusMd, padding: tokens.spacing4, borderWidth: 1, marginBottom: tokens.spacing4 },
  dangerTitle: { fontSize: 13, fontWeight: '700', marginBottom: tokens.spacing3 },
  dangerActions: { flexDirection: 'row', gap: tokens.spacing3 },
  dangerBtn: { flex: 1, borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing3, alignItems: 'center', borderWidth: 1 },
  dangerBtnText: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: tokens.spacing3, marginTop: tokens.spacing2 },
  empty: { fontSize: 14, textAlign: 'center', marginVertical: tokens.spacing6 },
  questionCard: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing2 },
  questionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: tokens.spacing2 },
  questionText: { flex: 1, fontSize: 13, lineHeight: 18 },
  statusBadge: { borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2, flexShrink: 0 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  questionDate: { fontSize: 11, marginTop: tokens.spacing2 },
});