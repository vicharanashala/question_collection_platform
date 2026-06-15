import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';

type Route = RouteProp<AdminStackParamList, 'AdminQuestionDetail'>;

export function AdminQuestionDetailScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation();
  const { showToast } = useToast();
  const route = useRoute<Route>();
  const { questionId } = route.params;

  const [q, setQ] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getQuestion(questionId)
      .then((r) => setQ(r.data))
      .catch((e) => showToast(getErrorMessage(e, 'Failed to load question'), 'error'))
      .finally(() => setLoading(false));
  }, [questionId]);

  async function doAction(action: 'approve' | 'reject' | 'request_info', reason?: string) {
    setActionLoading(action);
    try {
      await adminApi.reviewQuestion(questionId, { action, reason });
      showToast(`Question ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'info requested'}`, 'success');
      nav.goBack();
    } catch (e) {
      showToast(getErrorMessage(e, 'Action failed'), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function handleReject() {
    Alert.prompt('Reject', 'Reason (optional):', (r) => doAction('reject', r ?? undefined), 'plain-text');
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!q) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><Text style={{ color: c.text }}>Question not found</Text></View>
      </SafeAreaView>
    );
  }

  const user = q.user as Record<string, unknown> | null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Question Detail</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Status</Text>
          <Text style={[styles.value, { color: c.text }]}>{String(q.status)}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Question</Text>
          <Text style={[styles.questionText, { color: c.text }]}>{String(q.questionText)}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Metadata</Text>
          <View style={styles.metaGrid}>
            {[
              ['Language', String(q.language)],
              ['Category', String(q.domainCategory)],
              ['Crop', String(q.cropType)],
              ['Season', String(q.season)],
              ['State', String(q.state)],
              ['District', String(q.district)],
              ['AI Score', q.aiConfidenceScore != null ? `${String(q.aiConfidenceScore)}%` : 'N/A'],
            ].map(([k, v]) => (
              <View key={k} style={styles.metaRow}>
                <Text style={[styles.metaKey, { color: c.textSecondary }]}>{k}</Text>
                <Text style={[styles.metaVal, { color: c.text }]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {user && (
          <View style={[styles.section, { backgroundColor: c.surface }]}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Submitted By</Text>
            <Text style={[styles.value, { color: c.text }]}>{String(user.name ?? user.mobileNumber ?? 'Unknown')}</Text>
            <Text style={[styles.sub, { color: c.textSecondary }]}>{String(user.mobileNumber ?? '')} · {String(user.state ?? '')}</Text>
          </View>
        )}

        {!!q.rejectionReason && (
          <View style={[styles.section, { backgroundColor: c.error + '11' }]}>
            <Text style={[styles.label, { color: c.error }]}>Rejection Reason</Text>
            <Text style={[styles.value, { color: c.error }]}>{String(q.rejectionReason)}</Text>
          </View>
        )}

        {['pending', 'ai_review', 'human_review'].includes(String(q.status)) && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnApprove, { opacity: actionLoading ? 0.6 : 1 }]}
              onPress={() => doAction('approve')}
              disabled={!!actionLoading}
            >
              {actionLoading === 'approve'
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.btnText}>✓ Approve</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnReject, { opacity: actionLoading ? 0.6 : 1 }]}
              onPress={handleReject}
              disabled={!!actionLoading}
            >
              {actionLoading === 'reject'
                ? <ActivityIndicator size="small" color="#ef4444" />
                : <Text style={styles.btnTextReject}>✗ Reject</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: tokens.spacing5, paddingBottom: tokens.spacing3 },
  scroll: { padding: tokens.spacing5 },
  screenTitle: { fontSize: 22, fontWeight: '800', flex: 1 },
  section: { borderRadius: tokens.radiusMd, padding: tokens.spacing4, marginBottom: tokens.spacing3 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: tokens.spacing1 },
  value: { fontSize: 14, fontWeight: '600' },
  questionText: { fontSize: 15, lineHeight: 22 },
  metaGrid: { gap: tokens.spacing2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaKey: { fontSize: 13 },
  metaVal: { fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: tokens.spacing3, marginTop: tokens.spacing4 },
  btnApprove: { flex: 1, backgroundColor: '#22c55e', borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing4, alignItems: 'center' },
  btnReject: { flex: 1, backgroundColor: '#ef444422', borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing4, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnTextReject: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
});