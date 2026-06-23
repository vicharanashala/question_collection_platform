import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/Toast';
import { ReasonModal } from '../../components/ReasonModal';
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
  const [reasonAction, setReasonAction] = useState<'approve' | 'reject' | 'hold' | null>(null);

  useEffect(() => {
    adminApi.getQuestion(questionId)
      .then((r) => setQ(r.data))
      .catch((e) => showToast(getErrorMessage(e, 'Failed to load question'), 'error'))
      .finally(() => setLoading(false));
  }, [questionId]);

  async function doAction(action: 'approve' | 'reject' | 'hold', reason: string) {
    setActionLoading(action);
    try {
      const body: Parameters<typeof adminApi.reviewQuestion>[1] = { action };
      if (action === 'hold') {
        body.heldReason = reason;
      } else {
        body.reason = reason;
      }
      await adminApi.reviewQuestion(questionId, body);
      showToast(`Question ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'placed on hold'}`, 'success');
      nav.goBack();
    } catch (e) {
      showToast(getErrorMessage(e, 'Action failed'), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function openReasonModal(action: 'approve' | 'reject' | 'hold') {
    setReasonAction(action);
  }

  async function handleReasonConfirm(value: string) {
    if (!value.trim() || !reasonAction) return;
    await doAction(reasonAction, value);
    setReasonAction(null);
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!q) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><Text style={{ color: c.text }}>Question not found</Text></View>
      </SafeAreaView>
    );
  }

  const user = q.user as Record<string, unknown> | null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
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
              ['Category', ((q.domains as string[]) ?? []).join(', ') || '—'],
              ['Crop', String(q.cropType)],
              ['Season', String(q.season)],
              ['State', String(q.state)],
              ['District', String(q.district)],
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

        {!!q.heldReason && (
          <View style={[styles.section, { backgroundColor: '#f59e0b11' }]}>
            <Text style={[styles.label, { color: '#b45309' }]}>Hold Reason</Text>
            <Text style={[styles.value, { color: '#92400e' }]}>{String(q.heldReason)}</Text>
          </View>
        )}

        {!!q.approvalReason && (
          <View style={[styles.section, { backgroundColor: '#22c55e11' }]}>
            <Text style={[styles.label, { color: '#15803d' }]}>Approval Reason</Text>
            <Text style={[styles.value, { color: '#166534' }]}>{String(q.approvalReason)}</Text>
          </View>
        )}

        {!!q.reviewedByName && (
          <View style={[styles.section, { backgroundColor: c.surface }]}>
            <Text style={[styles.label, { color: c.textSecondary }]}>Reviewed By</Text>
            <Text style={[styles.value, { color: c.text }]}>{String(q.reviewedByName)}</Text>
          </View>
        )}

        {['pending', 'ai_review', 'human_review', 'held'].includes(String(q.status)) && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btnApprove, { opacity: actionLoading ? 0.6 : 1 }]}
              onPress={() => openReasonModal('approve')}
              disabled={!!actionLoading}
            >
              {actionLoading === 'approve'
                ? <ActivityIndicator size="small" color="#fff" />
                : <><Ionicons name="checkmark-circle" size={15} color="#fff" /><Text style={styles.btnText}> Approve</Text></>}
            </TouchableOpacity>
            <View style={styles.secondRow}>
              <TouchableOpacity
                style={[styles.btnHold, { opacity: actionLoading ? 0.6 : 1 }]}
                onPress={() => openReasonModal('hold')}
                disabled={!!actionLoading}
              >
                {actionLoading === 'hold'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Ionicons name="pause-circle" size={15} color="#fff" /><Text style={styles.btnTextHold}> Hold</Text></>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnReject, { opacity: actionLoading ? 0.6 : 1 }]}
                onPress={() => openReasonModal('reject')}
                disabled={!!actionLoading}
              >
                {actionLoading === 'reject'
                  ? <ActivityIndicator size="small" color="#ef4444" />
                  : <><Ionicons name="close-circle" size={15} color="#ef4444" /><Text style={styles.btnTextReject}> Reject</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <ReasonModal
        visible={reasonAction !== null}
        title={
          reasonAction === 'approve' ? 'Approve Question' :
          reasonAction === 'reject' ? 'Reject Question' :
          'Hold Question'
        }
        message={
          reasonAction === 'approve' ? 'Enter reason for approval:' :
          reasonAction === 'reject' ? 'Enter reason for rejection:' :
          'Enter reason for holding:'
        }
        confirmLabel={
          reasonAction === 'approve' ? 'Approve' :
          reasonAction === 'reject' ? 'Reject' :
          'Hold'
        }
        loading={actionLoading !== null}
        onConfirm={handleReasonConfirm}
        onClose={() => setReasonAction(null)}
      />
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
  actions: { gap: tokens.spacing3, marginTop: tokens.spacing4 },
  secondRow: { flexDirection: 'row', gap: tokens.spacing3 },
  btnApprove: { backgroundColor: '#22c55e', borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing4, alignItems: 'center' },
  btnHold: { flex: 1, backgroundColor: '#f59e0b', borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing4, alignItems: 'center' },
  btnReject: { flex: 1, backgroundColor: '#ef444422', borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing4, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnTextReject: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  btnTextHold: { color: '#fff', fontSize: 15, fontWeight: '700' },
});