import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/Toast';
import { questionApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { RootStackParamList } from '../../navigation/types';
import { Question } from '../../types';

type RouteProps = RouteProp<RootStackParamList, 'QuestionDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:      { label: 'Pending Review',     color: '#92400e', bg: '#fef3c7', icon: 'time-outline' },
  ai_review:    { label: 'AI Review',          color: '#1d4ed8', bg: '#dbeafe', icon: 'bulb-outline' },
  human_review: { label: 'Under Review',       color: '#5b21b6', bg: '#ede9fe', icon: 'eye-outline' },
  held:         { label: 'On Hold',            color: '#b45309', bg: '#fef3c7', icon: 'pause-circle-outline' },
  approved:     { label: 'Approved',           color: '#15803d', bg: '#dcfce7', icon: 'checkmark-circle' },
  rejected:     { label: 'Not Approved',       color: '#b91c1c', bg: '#fee2e2', icon: 'close-circle' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function QuestionDetailScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.colors;
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { showToast } = useToast();
  const { questionId } = route.params;

  const [q, setQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    questionApi.get(questionId)
      .then((r) => setQ(r.data as Question))
      .catch((e) => {
        setError(getErrorMessage(e, 'Failed to load question'));
        showToast(getErrorMessage(e, 'Failed to load question'), 'error');
      })
      .finally(() => setLoading(false));
  }, [questionId]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: c.text }]}>
            {t('notifications.questionDetail', 'Question Detail')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  if (error || !q) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: c.text }]}>
            {t('notifications.questionDetail', 'Question Detail')}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={c.textTertiary} />
          <Text style={[styles.errorText, { color: c.textSecondary }]}>{error ?? 'Question not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = STATUS_CONFIG[q.status] ?? STATUS_CONFIG.pending;

  // Media
  const hasMedia = q.mediaType !== 'none' && q.mediaUrls && q.mediaUrls.length > 0;
  const isImage = q.mediaType === 'image';
  const isVideo = q.mediaType === 'video';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text }]} numberOfLines={1}>
          {t('notifications.questionDetail', 'Question Detail')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status badge */}
        <View style={[styles.statusRow]}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Ionicons
              name={statusCfg.icon as keyof typeof Ionicons.glyphMap}
              size={15}
              color={statusCfg.color}
            />
            <Text style={[styles.statusLabel, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>
          <Text style={[styles.submittedAt, { color: c.textTertiary }]}>
            {new Date(q.submittedAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>

        {/* Question text */}
        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
            {t('notifications.yourQuestion', 'Your Question')}
          </Text>
          <Text style={[styles.questionText, { color: c.text }]}>
            {q.questionText}
          </Text>
        </View>

        {/* Media */}
        {hasMedia && isImage && (
          <View style={styles.mediaWrap}>
            <Image
              source={{ uri: q.mediaUrls![0] }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
            {q.mediaUrls!.length > 1 && (
              <Text style={[styles.mediaCount, { color: c.textSecondary }]}>
                +{q.mediaUrls!.length - 1} more
              </Text>
            )}
          </View>
        )}

        {hasMedia && isVideo && (
          <View style={[styles.mediaPlaceholder, { backgroundColor: c.muted }]}>
            <Ionicons name="videocam" size={40} color={c.textTertiary} />
            <Text style={[styles.mediaPlaceholderText, { color: c.textSecondary }]}>
              Video attached
            </Text>
          </View>
        )}

        {hasMedia && q.mediaType === 'audio' && (
          <View style={[styles.mediaPlaceholder, { backgroundColor: c.muted }]}>
            <Ionicons name="mic" size={40} color={c.textTertiary} />
            <Text style={[styles.mediaPlaceholderText, { color: c.textSecondary }]}>
              Audio attached
            </Text>
          </View>
        )}

        {/* Crop & Location metadata */}
        <View style={[styles.section, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
            {t('notifications.context', 'Context')}
          </Text>
          <View style={styles.metaGrid}>
            {[
              [t('question.domain') ?? 'Category', q.domainCategory],
              [t('question.season') ?? 'Season',    q.season],
              [t('question.cropType') ?? 'Crop',    q.cropType],
              [t('question.state') ?? 'State',      q.state],
              [t('question.district') ?? 'District', q.district],
              q.block ? [t('question.block') ?? 'Block', q.block] : null,
              [t('question.language') ?? 'Language', q.language],
            ]
              .filter((row): row is [string, string] => row !== null)
              .map(([k, v]) => (
                <View key={k} style={styles.metaRow}>
                  <Text style={[styles.metaKey, { color: c.textSecondary }]}>{k}</Text>
                  <Text style={[styles.metaVal, { color: c.text }]}>{v}</Text>
                </View>
              ))}
          </View>
        </View>

        {/* AI score */}
        {q.aiConfidenceScore != null && (
          <View style={[styles.section, { backgroundColor: c.surface }]}>
            <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
              {t('notifications.aiScore', 'AI Confidence Score')}
            </Text>
            <View style={styles.aiScoreRow}>
              <View style={[styles.aiScoreBar, { backgroundColor: c.muted }]}>
                <View
                  style={[
                    styles.aiScoreFill,
                    {
                      backgroundColor:
                        (q.aiConfidenceScore ?? 0) >= 80 ? '#22c55e'
                        : (q.aiConfidenceScore ?? 0) >= 50 ? '#f59e0b'
                        : '#ef4444',
                      width: `${q.aiConfidenceScore ?? 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.aiScoreText, { color: c.text }]}>
                {q.aiConfidenceScore}%
              </Text>
            </View>
          </View>
        )}

        {/* Review reason — rejection */}
        {q.status === 'rejected' && q.rejectionReason && (
          <View style={[styles.reasonCard, { backgroundColor: '#fee2e2' }]}>
            <View style={styles.reasonHeader}>
              <Ionicons name="close-circle" size={16} color="#b91c1c" />
              <Text style={[styles.reasonTitle, { color: '#b91c1c' }]}>
                {t('notifications.rejectionReason', 'Rejection Reason')}
              </Text>
            </View>
            <Text style={[styles.reasonBody, { color: '#991b1b' }]}>
              {q.rejectionReason}
            </Text>
          </View>
        )}

        {/* Review reason — hold */}
        {q.status === 'held' && q.heldReason && (
          <View style={[styles.reasonCard, { backgroundColor: '#fef3c7' }]}>
            <View style={styles.reasonHeader}>
              <Ionicons name="pause-circle" size={16} color="#b45309" />
              <Text style={[styles.reasonTitle, { color: '#b45309' }]}>
                {t('notifications.holdReason', 'Hold Reason')}
              </Text>
            </View>
            <Text style={[styles.reasonBody, { color: '#92400e' }]}>
              {q.heldReason}
            </Text>
          </View>
        )}

        {/* Review reason — info requested */}
        {q.status === 'human_review' && (
          <View style={[styles.reasonCard, { backgroundColor: '#dbeafe' }]}>
            <View style={styles.reasonHeader}>
              <Ionicons name="information-circle" size={16} color="#1d4ed8" />
              <Text style={[styles.reasonTitle, { color: '#1d4ed8' }]}>
                {t('notifications.infoRequested', 'Additional Information Needed')}
              </Text>
            </View>
            <Text style={[styles.reasonBody, { color: '#1e40af' }]}>
              Our team needs more details to process your question. Please update your question or submit a new one with more information.
            </Text>
          </View>
        )}

        {/* Approval note */}
        {q.status === 'approved' && q.approvalReason && (
          <View style={[styles.reasonCard, { backgroundColor: '#dcfce7' }]}>
            <View style={styles.reasonHeader}>
              <Ionicons name="checkmark-circle" size={16} color="#15803d" />
              <Text style={[styles.reasonTitle, { color: '#15803d' }]}>
                {t('notifications.approvedNote', 'Approval Note')}
              </Text>
            </View>
            <Text style={[styles.reasonBody, { color: '#166534' }]}>
              {q.approvalReason}
            </Text>
          </View>
        )}

        {/* Reviewed by */}
        {q.reviewedAt && q.reviewedByName && (
          <Text style={[styles.reviewedBy, { color: c.textTertiary }]}>
            Reviewed by {q.reviewedByName} on{' '}
            {new Date(q.reviewedAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
  },
  screenTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.spacing3 },
  errorText: { fontSize: 15 },

  scroll: { padding: tokens.spacing4, gap: tokens.spacing4, paddingBottom: tokens.spacing8 },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusFull,
    paddingVertical: tokens.spacing2,
    paddingHorizontal: tokens.spacing3,
  },
  statusLabel: { fontSize: 13, fontWeight: '600' },
  submittedAt: { fontSize: 12 },

  section: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    gap: tokens.spacing3,
  },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },

  mediaWrap: { gap: tokens.spacing2 },
  mediaImage: {
    width: '100%',
    height: Math.round(width * 0.6),
    borderRadius: tokens.radiusLg,
  },
  mediaCount: { fontSize: 12, textAlign: 'center' },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    borderRadius: tokens.radiusLg,
    gap: tokens.spacing2,
  },
  mediaPlaceholderText: { fontSize: 14 },

  metaGrid: { gap: tokens.spacing3 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaKey: { fontSize: 13 },
  metaVal: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: tokens.spacing4 },

  aiScoreRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3 },
  aiScoreBar: { flex: 1, height: 8, borderRadius: tokens.radiusFull, overflow: 'hidden' },
  aiScoreFill: { height: '100%', borderRadius: tokens.radiusFull },
  aiScoreText: { fontSize: 14, fontWeight: '700', minWidth: 40, textAlign: 'right' },

  reasonCard: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    gap: tokens.spacing2,
  },
  reasonHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  reasonTitle: { fontSize: 13, fontWeight: '700' },
  reasonBody: { fontSize: 14, lineHeight: 20 },

  reviewedBy: { fontSize: 12, textAlign: 'center' },
});