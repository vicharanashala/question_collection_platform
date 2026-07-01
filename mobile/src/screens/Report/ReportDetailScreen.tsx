import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/Toast';
import { reportsApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import type { Report } from '../../api/client';

const STATUS_COLORS: Record<string, string> = {
  open:        '#3B82F6',
  in_progress: '#F59E0B',
  resolved:    '#22C55E',
  closed:      '#6B7280',
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  open:        'report.status.open',
  in_progress: 'report.status.in_progress',
  resolved:    'report.status.resolved',
  closed:      'report.status.closed',
};

interface Props {
  route: { params: { reportId: string } };
  navigation: { goBack: () => void };
}

export function ReportDetailScreen({ route, navigation }: Props) {
  const { reportId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    // Guard: skip if already have data or already loading
    if (report) return;
    setLoading(true);
    try {
      const { data } = await reportsApi.getMyReport(reportId);
      setReport(data as Report);
    } catch {
      showToast(t('report.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [reportId, t, showToast, report]);

  React.useEffect(() => { fetchReport() }, [fetchReport]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text }]}>{t('report.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!report) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text }]}>{t('report.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: c.textSecondary }}>{t('report.loadError')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('report.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: tokens.spacing4 }}>
        {/* Metadata */}
        <View style={[styles.metaCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.metaRow}>
            <View>
              <Text style={[styles.metaLabel, { color: c.textTertiary }]}>Category</Text>
              <Text style={[styles.metaValue, { color: c.text }]}>
                {t(`report.categories.${report.category}` as any) ?? report.category}
              </Text>
            </View>
            <View>
              <Text style={[styles.metaLabel, { color: c.textTertiary }]}>Status</Text>
              <Text style={[styles.statusText, { color: STATUS_COLORS[report.status] }]}>
                {t(STATUS_LABEL_KEYS[report.status] as any)}
              </Text>
            </View>
          </View>
          <Text style={[styles.metaDate, { color: c.textTertiary }]}>
            {t('report.submittedOn', { date: new Date(report.createdAt).toLocaleDateString('en-IN') })}
          </Text>
        </View>

        {/* Title + Description */}
        <Text style={[styles.reportTitle, { color: c.text }]}>{report.title}</Text>
        <Text style={[styles.reportDesc, { color: c.textSecondary }]}>{report.description}</Text>

        {/* Replies */}
        {report.replies && report.replies.length > 0 && (
          <View style={{ marginTop: tokens.spacing4 }}>
            <Text style={[styles.sectionTitle, { color: c.textTertiary }]}>
              {t('report.replies', { count: report.replies.length })}
            </Text>
            {report.replies.map((reply) => (
              <View
                key={reply.id}
                style={[styles.replyCard, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <View style={styles.replyHeader}>
                  <View style={[styles.avatar, { backgroundColor: c.primary }]}>
                    <Text style={styles.avatarText}>
                      {(reply.admin?.name ?? 'A').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.replyAdminName, { color: c.text }]}>
                      {reply.admin?.name ?? 'Admin'}
                    </Text>
                    <Text style={[styles.replyDate, { color: c.textTertiary }]}>
                      {new Date(reply.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.replyMessage, { color: c.textSecondary }]}>{reply.message}</Text>
              </View>
            ))}
          </View>
        )}

        {(!report.replies || report.replies.length === 0) && (
          <View style={[styles.noRepliesCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="chatbubbles-outline" size={32} color={c.textTertiary} />
            <Text style={[styles.noRepliesText, { color: c.textTertiary }]}>
              {t('report.noReplies')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4, paddingVertical: tokens.spacing3, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  metaCard: {
    borderWidth: 1, borderRadius: 12, padding: tokens.spacing4,
    marginBottom: tokens.spacing4,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: tokens.spacing3 },
  metaLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  metaValue: { fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  metaDate: { fontSize: 12 },
  reportTitle: { fontSize: 17, fontWeight: '700', marginBottom: tokens.spacing2 },
  reportDesc: { fontSize: 14, lineHeight: 20, marginBottom: tokens.spacing4 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: tokens.spacing3,
  },
  replyCard: {
    borderWidth: 1, borderRadius: 12, padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: tokens.spacing2 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  replyAdminName: { fontSize: 14, fontWeight: '600' },
  replyDate: { fontSize: 11 },
  replyMessage: { fontSize: 14, lineHeight: 20 },
  noRepliesCard: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: tokens.spacing6, borderWidth: 1, borderRadius: 12, gap: 8,
  },
  noRepliesText: { fontSize: 14 },
});