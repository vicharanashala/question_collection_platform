import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TooltipIcon } from '../../components/TooltipIcon';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { questionApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { MainTabParamList } from '../../navigation/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  questionText: string;
  domains: string[];
  season: string;
  cropType: string;
  state: string;
  district: string;
  status: 'pending' | 'approved' | 'rejected';
  mediaType: 'none' | 'image' | 'video' | 'audio';
  submittedAt: string;
  editWindowClosesAt: string | null;
  rejectionReason?: string;
}

interface QuestionsResponse {
  items: Question[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:   { label: 'Pending',   color: '#E88B00', icon: 'time-outline' },
  approved:  { label: 'Approved',  color: '#16A34A', icon: 'checkmark-circle' },
  rejected:  { label: 'Rejected',  color: '#DC2626', icon: 'close-circle' },
};

const SEASON_LABELS: Record<string, string> = {
  kharif: 'Kharif',
  rabi: 'Rabi',
  zaid: 'Zaid',
  year_round: 'Year Round',
};

const MAX_VISIBLE_DOMAINS = 2;
const getDomainSummary = (domains: string[] | undefined): string => {
  if (!domains?.length) return '—';
  if (domains.length <= MAX_VISIBLE_DOMAINS) return domains.join(', ');
  const visible = domains.slice(0, MAX_VISIBLE_DOMAINS).join(', ');
  return `${visible} +${domains.length - MAX_VISIBLE_DOMAINS} more`;
};

function isWithinEditWindow(q: Question): boolean {
  if (!q.editWindowClosesAt) return false;
  return new Date(q.editWindowClosesAt) > new Date();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MyQuestionsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<NativeStackNavigationProp<MainTabParamList>>();
  const { t } = useTranslation();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchQuestions = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (pageNum === 1) setLoading(true);

    try {
      const res = await questionApi.getMyQuestions({ page: pageNum, limit: 20 });
      const data = res.data as QuestionsResponse;
      setQuestions((prev) =>
        pageNum === 1 ? data.items : [...prev, ...data.items],
      );
      setHasMore(data.page < data.pages);
      setPage(pageNum);
    } catch (err) {
      console.log('[MyQuestions] fetch error:', err);
      Alert.alert(t('common.error'), t('myQuestions.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions(1);
  }, [fetchQuestions]);

  async function handleRefresh() {
    await fetchQuestions(1, true);
  }

  async function handleLoadMore() {
    if (!hasMore || loading) return;
    await fetchQuestions(page + 1);
  }

  function handleEdit(question: Question) {
    if (!isWithinEditWindow(question)) {
      Alert.alert(t('myQuestions.editWindowClosedTitle') ?? t('common.error'), t('myQuestions.editWindowClosed'));
      return;
    }
    // Navigate to AskQuestion tab with the questionId — QuestionScreen will open in edit mode
    navigation.navigate('AskQuestion', { questionId: question.id } as never);
  }

  // ─── List Item ──────────────────────────────────────────────────────────────

  function renderItem({ item: q }: { item: Question }) {
    const statusMeta = STATUS_META[q.status] ?? STATUS_META.pending;
    const withinEditWindow = isWithinEditWindow(q);
    const catLabel = getDomainSummary(q.domains);
    const seasonLabel = SEASON_LABELS[q.season] ?? q.season;

    return (
      <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
        {/* Header row: status badge + edit button */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '18' }]}>
            <Ionicons name={statusMeta.icon as keyof typeof Ionicons.glyphMap} size={13} color={statusMeta.color} />
            <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
          {q.status === 'pending' && (
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: withinEditWindow ? c.primary : c.muted }]}
              onPress={() => handleEdit(q)}
              disabled={!withinEditWindow}
            >
              <Ionicons
                name="pencil"
                size={14}
                color={withinEditWindow ? '#fff' : c.textTertiary}
              />
              <Text style={[styles.editBtnText, { color: withinEditWindow ? '#fff' : c.textTertiary }]}>
                {t('myQuestions.edit')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Question text */}
        <Text style={[styles.questionText, { color: c.text }]} numberOfLines={3}>
          {q.questionText}
        </Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="leaf" size={12} color={c.textTertiary} />
            <Text style={[styles.metaChipText, { color: c.textSecondary }]}>{q.cropType}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="grid" size={12} color={c.textTertiary} />
            <Text style={[styles.metaChipText, { color: c.textSecondary }]}>{catLabel}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="calendar" size={12} color={c.textTertiary} />
            <Text style={[styles.metaChipText, { color: c.textSecondary }]}>{seasonLabel}</Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.metaChip}>
          <Ionicons name="location" size={12} color={c.textTertiary} />
          <Text style={[styles.metaChipText, { color: c.textSecondary }]}>
            {q.district}{q.state ? `, ${q.state}` : ''}
          </Text>
        </View>

        {/* Rejection reason */}
        {q.status === 'rejected' && q.rejectionReason && (
          <View style={[styles.rejectionBox, { backgroundColor: c.error + '10' }]}>
            <Ionicons name="information-circle" size={14} color={c.error} />
            <Text style={[styles.rejectionText, { color: c.error }]} numberOfLines={2}>
              {q.rejectionReason}
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <Text style={[styles.timestamp, { color: c.textTertiary }]}>
          {new Date(q.submittedAt).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </View>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading && questions.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.centerText, { color: c.textSecondary }]}>{t('myQuestions.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: c.text }]}>{t('myQuestions.title')}</Text>
              <TooltipIcon
                description="All your submitted questions are listed here. Tap any question to view details, edit within the window, or check its approval status."
                size={18}
              />
            </View>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {questions.length > 0
                ? t('myQuestions.subtitle', { count: questions.length, s: questions.length !== 1 ? 's' : '' })
                : t('myQuestions.noQuestions')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={56} color={c.textTertiary} />
            <Text style={[styles.emptyTitle, { color: c.textSecondary }]}>{t('myQuestions.noQuestions')}</Text>
            <Text style={[styles.emptyBody, { color: c.textTertiary }]}>
              {t('myQuestions.startAsking')}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: tokens.spacing4, paddingBottom: tokens.spacing8, flexGrow: 1 },
  header: { paddingTop: tokens.spacing6, paddingBottom: tokens.spacing4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  centerText: { fontSize: 14, marginTop: tokens.spacing3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: tokens.spacing4 },
  emptyBody: { fontSize: 13, marginTop: tokens.spacing2, textAlign: 'center' },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing4, marginBottom: tokens.spacing4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: tokens.radiusFull, paddingHorizontal: tokens.spacing2, paddingVertical: 3, gap: 4 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: tokens.radiusMd, paddingHorizontal: tokens.spacing3, paddingVertical: 5, gap: 4 },
  editBtnText: { fontSize: 12, fontWeight: '600' },
  questionText: { fontSize: 14, lineHeight: 20, fontWeight: '500', marginBottom: tokens.spacing3 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing1, marginBottom: tokens.spacing1 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaChipText: { fontSize: 12 },
  rejectionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginTop: tokens.spacing2 },
  rejectionText: { fontSize: 12, flex: 1, lineHeight: 18 },
  timestamp: { fontSize: 11, marginTop: tokens.spacing2, textAlign: 'right' },
});