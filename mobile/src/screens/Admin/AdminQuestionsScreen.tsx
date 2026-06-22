import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, ScrollView, Dimensions, KeyboardAvoidingView, Platform,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { UserRole } from '../../types';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import { AdminFilterModal, FilterOption, ActiveFilters } from '../../components/AdminFilterModal';
import { INDIAN_STATES, CROP_OPTIONS } from '../../utils/constants';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const { width: SCREEN_W } = Dimensions.get('window');
const IS_NARROW = SCREEN_W < 700;

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  ai_review: '#8b5cf6',
  human_review: '#ec4899',
  held: '#d97706',
  approved: '#22c55e',
  rejected: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  ai_review: 'AI Review',
  human_review: 'Manual',
  held: 'Held',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending',      label: 'Pending' },
  { value: 'ai_review',    label: 'AI Review' },
  { value: 'human_review', label: 'Manual' },
  { value: 'held',         label: 'Held' },
  { value: 'approved',     label: 'Approved' },
  { value: 'rejected',     label: 'Rejected' },
];

const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s, label: s }));

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'submittedAt:DESC',        label: 'Newest First' },
  { value: 'submittedAt:ASC',         label: 'Oldest First' },
  { value: 'aiConfidenceScore:DESC', label: 'AI Confidence ↓' },
  { value: 'aiConfidenceScore:ASC',  label: 'AI Confidence ↑' },
  { value: 'state:ASC',               label: 'State A→Z' },
];

interface QueueItem {
  id: string;
  questionText: string;
  language: string;
  domains: string[];
  cropType: string;
  state: string;
  district: string;
  mediaType: string;
  status: string;
  aiConfidenceScore: number | null;
  submittedAt: string;
  user: { id: string; name: string; mobileNumber: string } | null;
  heldReason: string | null;
  approvalReason: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
}

const FILTERS: FilterOption[] = [
  { key: 'search',    label: 'Search',    type: 'text',     placeholder: 'Question or mobile number…' },
  { key: 'status',    label: 'Status',    type: 'select',   options: STATUS_OPTIONS },
  { key: 'crop',      label: 'Crop',      type: 'select',   options: CROP_OPTIONS },
  { key: 'state',     label: 'State',     type: 'select',   options: STATE_OPTIONS },
  { key: 'sortBy',    label: 'Sort By',   type: 'select',   options: SORT_OPTIONS },
  { key: 'fromDate',  label: 'From Date', type: 'date',     placeholder: 'YYYY-MM-DD' },
  { key: 'toDate',    label: 'To Date',   type: 'date',     placeholder: 'YYYY-MM-DD' },
];

const EMPTY_FILTERS: ActiveFilters = {
  search: '', status: '', crop: '', state: '',
  sortBy: 'submittedAt:DESC', fromDate: '', toDate: '',
};

function buildQueryParams(active: ActiveFilters, page: number): Record<string, string | number> {
  const params: Record<string, string | number> = { page, limit: 20 };
  if (active.search) params.search = active.search;
  if (active.state) params.state = active.state;
  if (active.status) params.status = active.status;
  if (active.crop) params.crop = active.crop;
  if (active.fromDate) params.fromDate = active.fromDate;
  if (active.toDate) params.toDate = active.toDate;
  const sortBy = active.sortBy?.split(':')[0];
  const sortOrder = active.sortBy?.split(':')[1];
  if (sortBy && sortBy !== 'submittedAt') params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return params;
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ReasonModal({ visible, title, message, confirmLabel, loading, onConfirm, onClose }: {
  visible: boolean; title: string; message?: string; confirmLabel: string;
  loading: boolean; onConfirm: (v: string) => void; onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [value, setValue] = useState('');
  if (!visible) return null;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
      <View style={[styles.modalDialog, { backgroundColor: c.surface }]}>
        <Text style={[styles.modalTitle, { color: c.text }]}>{title}</Text>
        {message && <Text style={[styles.modalMsg, { color: c.textSecondary }]}>{message}</Text>}
        <TextInput
          style={[styles.modalInput, { backgroundColor: c.input, borderColor: c.borderSubtle, color: c.text }]}
          placeholder="Enter reason…"
          placeholderTextColor={c.textTertiary}
          value={value}
          onChangeText={setValue}
          multiline
          numberOfLines={3}
          autoFocus
        />
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.modalBtn, { borderColor: c.border, borderWidth: 1 }]} onPress={() => { setValue(''); onClose(); }}>
            <Text style={[styles.modalBtnText, { color: c.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: value.trim() ? c.primary : c.textTertiary + '40' }]}
            onPress={() => { if (value.trim()) { onConfirm(value.trim()); setValue(''); } }}
            disabled={!value.trim() || loading}
          >
            {loading
              ? <Text style={styles.modalBtnText}><ActivityIndicator size="small" color="#fff" /></Text>
              : <Text style={[styles.modalBtnText, { color: '#fff' }]}>{confirmLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function DetailPanel({ item, processing, onAction, onViewDetail }: {
  item: QueueItem;
  processing: boolean;
  onAction: (id: string, action: 'approve' | 'reject' | 'hold') => void;
  onViewDetail: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [modal, setModal] = useState<{ action: 'approve' | 'reject' | 'hold' } | null>(null);

  const color = STATUS_COLORS[item.status] ?? '#999';

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function confirmAction(reason: string) {
    onAction(item.id, modal!.action);
    setModal(null);
  }

  return (
    <View style={[styles.detailPanel, { backgroundColor: c.surface }]}>
      {/* Panel header */}
      <View style={[styles.panelHeader, { borderBottomColor: c.borderSubtle }]}>
        <View style={[styles.statusPill, { backgroundColor: color + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusPillText, { color }]}>{STATUS_LABELS[item.status] ?? item.status}</Text>
        </View>
        <TouchableOpacity onPress={() => onViewDetail(item.id)} style={styles.viewDetailBtn}>
          <Text style={[styles.viewDetailText, { color: c.primary }]}>Full Details</Text>
          <Ionicons name="arrow-forward" size={13} color={c.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
        {/* Held reason banner */}
        {item.status === 'held' && item.heldReason && (
          <View style={[styles.reasonBanner, { backgroundColor: '#f59e0b15' }]}>
            <Ionicons name="pause-circle" size={14} color="#f59e0b" />
            <Text style={styles.reasonBannerText}>"{item.heldReason}"</Text>
          </View>
        )}

        {/* Question text */}
        <Text style={[styles.questionText, { color: c.text }]}>{item.questionText}</Text>

        {/* Meta grid */}
        <View style={[styles.metaGrid, { backgroundColor: c.surfaceVariant }]}>
          {[
            ['Language', item.language],
            ['Category', item.domains?.join(', ') ?? '—'],
            ['Crop', item.cropType],
            ['Season', (item as any).season ?? '—'],
            ['State', item.state],
            ['District', item.district || '—'],
          ].map(([k, v]) => (
            <View key={k} style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: c.textSecondary }]}>{k}</Text>
              <Text style={[styles.metaVal, { color: c.text }]} numberOfLines={1}>{v}</Text>
            </View>
          ))}
          {item.aiConfidenceScore != null && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaKey, { color: c.textSecondary }]}>AI Score</Text>
              <View style={styles.aiScoreVal}>
                <Ionicons name="bulb" size={12} color="#f59e0b" />
                <Text style={[styles.metaVal, { color: c.text }]}> {item.aiConfidenceScore}%</Text>
              </View>
            </View>
          )}
        </View>

        {/* Submitter */}
        <View style={styles.sectionLabel}>
          <Text style={[styles.sectionLabelText, { color: c.textSecondary }]}>Submitted By</Text>
        </View>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: c.primary + '22' }]}>
            <Text style={[styles.avatarText, { color: c.primary }]}>
              {(item.user?.name ?? '?')[0].toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.userName, { color: c.text }]}>{item.user?.name ?? 'Unknown'}</Text>
            <Text style={[styles.userMobile, { color: c.textSecondary }]}>{item.user?.mobileNumber ?? ''}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={[styles.submitDate, { color: c.textTertiary }]}>{formatDate(item.submittedAt)}</Text>
        </View>

        {/* Media indicator */}
        {item.mediaType && item.mediaType !== 'none' && (
          <View style={[styles.mediaRow]}>
            <Ionicons name={item.mediaType === 'image' ? 'image' : item.mediaType === 'video' ? 'videocam' : 'mic'} size={14} color={c.textSecondary} />
            <Text style={[styles.mediaText, { color: c.textSecondary }]}> {item.mediaType.charAt(0).toUpperCase() + item.mediaType.slice(1)} attached</Text>
          </View>
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={[styles.panelActions, { borderTopColor: c.borderSubtle }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
          onPress={() => setModal({ action: 'approve' })}
          disabled={processing}
        >
          {processing ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.actionBtnText}> Approve</Text></>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
          onPress={() => setModal({ action: 'hold' })}
          disabled={processing}
        >
          {processing ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="pause" size={16} color="#fff" /><Text style={styles.actionBtnText}> Hold</Text></>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
          onPress={() => setModal({ action: 'reject' })}
          disabled={processing}
        >
          {processing ? <ActivityIndicator size="small" color="#fff" />
            : <><Ionicons name="close" size={16} color="#fff" /><Text style={styles.actionBtnText}> Reject</Text></>}
        </TouchableOpacity>
      </View>

      <ReasonModal
        visible={modal !== null}
        title={modal?.action === 'approve' ? 'Approve Question' : modal?.action === 'reject' ? 'Reject Question' : 'Hold Question'}
        message={modal?.action === 'approve' ? 'Enter reason for approval:' : modal?.action === 'reject' ? 'Enter reason for rejection:' : 'Enter reason for holding:'}
        confirmLabel={modal?.action === 'approve' ? 'Approve' : modal?.action === 'reject' ? 'Reject' : 'Hold'}
        loading={processing}
        onConfirm={confirmAction}
        onClose={() => setModal(null)}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function AdminQuestionsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { showToast } = useToast();

  // Admins skip the pending queue and go straight to processed questions
  useEffect(() => {
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) {
      nav.replace('AdminProcessedQuestions');
    }
  }, [user?.role, nav]);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const didExplicitlyDeselect = useRef(false);
  const listPanelRef = useRef<{ scrollToItem: (id: string) => void } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(activeFilters.search), 400);
    return () => clearTimeout(t);
  }, [activeFilters.search]);

  const effectiveFilters: ActiveFilters = { ...activeFilters, search: debouncedSearch };

  useEffect(() => {
    didExplicitlyDeselect.current = false;
    setPage(1);
    setSelectedId(null);
    setLoading(true);
    loadData(1, true, effectiveFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilters.status, activeFilters.state, activeFilters.fromDate, activeFilters.toDate, activeFilters.sortBy]);

  async function loadData(pageNum: number, refresh: boolean, filters: ActiveFilters) {
    try {
      const params = buildQueryParams(filters, pageNum);
      const res = await adminApi.getReviewQueue(params);
      const data = res.data;
      const newItems: QueueItem[] = data.items ?? [];
      setItems(refresh ? newItems : (prev) => [...prev, ...newItems]);
      setTotal(data.total ?? 0);
      setHasMore(newItems.length === 20);
      setPage(pageNum);
      if (!didExplicitlyDeselect.current && newItems.length > 0 && selectedId === null && items.length === 0) {
        setSelectedId(newItems[0].id);
      }
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load queue'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData(1, true, effectiveFilters);
  }

  async function loadMore() {
    if (!hasMore || loading) return;
    await loadData(page + 1, false, effectiveFilters);
  }

  function handleApplyFilters(filters: ActiveFilters) { setActiveFilters(filters); }
  function handleResetFilters() { setActiveFilters({ ...EMPTY_FILTERS }); }

  async function handleAction(id: string, action: 'approve' | 'reject' | 'hold') {
    setProcessing(id);
    try {
      await adminApi.reviewQuestion(id, { action, reason: '', heldReason: action === 'hold' ? '' : undefined } as any);
      setItems((prev) => prev.filter((q) => q.id !== id));
      if (id === selectedId) {
        didExplicitlyDeselect.current = false;
        setSelectedId(null);
      }
      showToast(
        action === 'approve' ? 'Question approved' :
        action === 'hold' ? 'Question placed on hold' : 'Question rejected',
        'success',
      );
    } catch (e) {
      showToast(getErrorMessage(e, `Failed to ${action}`), 'error');
    } finally {
      setProcessing(null);
    }
  }

  function handleSelectQuestion(id: string) {
    if (id === selectedId) {
      didExplicitlyDeselect.current = true;
      setSelectedId(null);
    } else {
      setSelectedId(id);
    }
  }

  function handleViewDetail(id: string) {
    nav.navigate('AdminQuestionDetail', { questionId: id });
  }

  const selectedItem = items.find((q) => q.id === selectedId) ?? null;
  const activeCount = Object.entries(activeFilters).filter(([k, v]) => {
    if (k === 'sortBy') return v !== 'submittedAt:DESC';
    return v && v.trim().length > 0;
  }).length;

  // ─── List Card ───────────────────────────────────────────────────────────────
  function renderItem({ item }: { item: QueueItem }) {
    const isSelected = item.id === selectedId;
    const color = STATUS_COLORS[item.status] ?? '#999';
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => handleSelectQuestion(item.id)}
        style={[
          styles.listCard,
          { backgroundColor: c.surface },
          isSelected && { backgroundColor: color + '10', borderLeftWidth: 3, borderLeftColor: color },
        ]}
      >
        <View style={styles.listCardTop}>
          <View style={styles.listCardMeta}>
            <Text style={[styles.listCrop, { color: c.primary }]} numberOfLines={1}>{item.cropType}</Text>
            <Text style={[styles.listSep, { color: c.textTertiary }]}>·</Text>
            <Text style={[styles.listState, { color: c.textSecondary }]} numberOfLines={1}>{item.state}</Text>
            {item.district && <><Text style={[styles.listSep, { color: c.textTertiary }]}>·</Text><Text style={[styles.listDistrict, { color: c.textSecondary }]} numberOfLines={1}>{item.district}</Text></>}
          </View>
          <View style={[styles.listBadge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.listBadgeText, { color: color }]}>{STATUS_LABELS[item.status] ?? item.status}</Text>
          </View>
        </View>

        <Text style={[styles.listQuestion, { color: c.text }]} numberOfLines={2}>{item.questionText}</Text>

        <View style={styles.listCardFooter}>
          <Text style={[styles.listSubmitter, { color: c.textSecondary }]} numberOfLines={1}>
            {item.user?.name ?? item.user?.mobileNumber ?? 'Unknown'}
          </Text>
          {item.aiConfidenceScore != null && (
            <View style={styles.listAiRow}>
              <Ionicons name="bulb" size={10} color="#f59e0b" />
              <Text style={[styles.listAi, { color: c.textTertiary }]}> {item.aiConfidenceScore}%</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Question Review</Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.headerCount, { color: c.textSecondary }]}>{total}</Text>
        {(user?.role === 'admin' || user?.role === 'curator') && (
          <TouchableOpacity
            onPress={() => nav.navigate('AdminProcessedQuestions')}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <Text style={[styles.headerProcessed, { color: c.primary }]}>Processed</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.headerFilter, { backgroundColor: activeCount > 0 ? c.primary + '18' : c.surfaceVariant }]}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons name="options" size={16} color={activeCount > 0 ? c.primary : c.textSecondary} />
          {activeCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: c.primary }]}>
              <Text style={styles.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Two-panel body */}
      <View style={styles.body}>
        {/* ── Left: List panel — hidden on narrow screens once an item is selected ── */}
        {(!IS_NARROW || !selectedItem) && (
        <View style={[styles.listPanel, { backgroundColor: c.background, borderRightColor: c.borderSubtle }]}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { backgroundColor: c.background }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                {loading ? null : (
                  <>
                    <Ionicons name="document-text-outline" size={40} color={c.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: c.text }]}>No questions found</Text>
                    <Text style={[styles.emptyMsg, { color: c.textSecondary }]}>Adjust filters or check back later</Text>
                  </>
                )}
              </View>
            }
            ListHeaderComponent={
              loading ? (
                <View style={styles.listLoader}>
                  <ActivityIndicator size="large" color={c.primary} />
                </View>
              ) : null
            }
          />
        </View>
        )}

        {/* ── Right: Detail panel ── */}
        {IS_NARROW ? (
          // On narrow screens, detail replaces list when item selected
          selectedItem ? (
            <View style={[styles.mobileDetail, { backgroundColor: c.background }]}>
              <TouchableOpacity style={styles.backToList} onPress={() => setSelectedId(null)}>
                <Ionicons name="chevron-back" size={18} color={c.primary} />
                <Text style={[styles.backToListText, { color: c.primary }]}>Back to list</Text>
              </TouchableOpacity>
              <DetailPanel
                item={selectedItem}
                processing={processing === selectedItem.id}
                onAction={handleAction}
                onViewDetail={handleViewDetail}
              />
            </View>
          ) : (
            <View style={[styles.mobileDetail, { backgroundColor: c.background }]}>
              <View style={styles.emptyDetail}>
                <Ionicons name="hand-left-outline" size={44} color={c.textTertiary} />
                <Text style={[styles.emptyDetailTitle, { color: c.text }]}>Select a question</Text>
                <Text style={[styles.emptyDetailMsg, { color: c.textSecondary }]}>Tap one from the list to review it</Text>
              </View>
            </View>
          )
        ) : selectedItem ? (
          <DetailPanel
            item={selectedItem}
            processing={processing === selectedItem.id}
            onAction={handleAction}
            onViewDetail={handleViewDetail}
          />
        ) : (
          <View style={[styles.emptyDetail, { backgroundColor: c.surface }]}>
            <Ionicons name="hand-left-outline" size={44} color={c.textTertiary} />
            <Text style={[styles.emptyDetailTitle, { color: c.text }]}>Select a question</Text>
            <Text style={[styles.emptyDetailMsg, { color: c.textSecondary }]}>Tap one from the list to review it</Text>
          </View>
        )}
      </View>

      <AdminFilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={FILTERS}
        active={activeFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        title="Filter Questions"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing5,
    paddingVertical: tokens.spacing4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: tokens.spacing3,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerCount: { fontSize: 13 },
  headerProcessed: { fontSize: 13, fontWeight: '700' },
  headerFilter: {
    width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: tokens.spacing1,
  },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 15, height: 15, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  body: { flex: 1, flexDirection: 'row' },
  listPanel: { width: IS_NARROW ? '100%' : 340, borderRightWidth: StyleSheet.hairlineWidth },
  listContent: { padding: tokens.spacing3, gap: tokens.spacing2 },
  listCard: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginBottom: 2,
    ...tokens.shadowSm,
  },
  listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing2 },
  listCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, marginRight: tokens.spacing2 },
  listCrop: { fontSize: 11, fontWeight: '700' },
  listSep: { fontSize: 11 },
  listState: { fontSize: 11 },
  listDistrict: { fontSize: 11 },
  listBadge: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  listBadgeText: { fontSize: 10, fontWeight: '700' },
  listQuestion: { fontSize: 13, lineHeight: 18, marginBottom: tokens.spacing2 },
  listCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listSubmitter: { fontSize: 11, flex: 1 },
  listAiRow: { flexDirection: 'row', alignItems: 'center' },
  listAi: { fontSize: 11 },
  listLoader: { paddingVertical: tokens.spacing8, alignItems: 'center' },
  emptyList: { alignItems: 'center', marginTop: 60, gap: tokens.spacing2 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyMsg: { fontSize: 13 },

  // Detail panel
  detailPanel: { flex: 1 },
  panelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: tokens.spacing5, paddingVertical: tokens.spacing4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  viewDetailBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewDetailText: { fontSize: 12, fontWeight: '600' },
  panelScroll: { flex: 1 },
  panelContent: { padding: tokens.spacing5 },
  reasonBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: tokens.radiusMd, paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing2, marginBottom: tokens.spacing4 },
  reasonBannerText: { fontSize: 12, color: '#b45309', fontStyle: 'italic', marginLeft: tokens.spacing2, flex: 1 },
  questionText: { fontSize: 16, lineHeight: 24, fontWeight: '500', marginBottom: tokens.spacing4 },
  metaGrid: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing4, gap: tokens.spacing2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaKey: { fontSize: 12 },
  metaVal: { fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' },
  aiScoreVal: { flexDirection: 'row', alignItems: 'center' },
  sectionLabel: { marginBottom: tokens.spacing2 },
  sectionLabelText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3, marginBottom: tokens.spacing3 },
  avatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700' },
  userName: { fontSize: 14, fontWeight: '600' },
  userMobile: { fontSize: 12 },
  submitDate: { fontSize: 11 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', marginTop: tokens.spacing1 },
  mediaText: { fontSize: 12 },
  panelActions: {
    flexDirection: 'row', gap: tokens.spacing3, padding: tokens.spacing4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3, justifyContent: 'center', alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Empty states
  emptyDetail: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing3, padding: tokens.spacing8 },
  emptyDetailTitle: { fontSize: 17, fontWeight: '700' },
  emptyDetailMsg: { fontSize: 13, textAlign: 'center' },

  // Narrow-screen detail
  mobileDetail: { flex: 1 },
  backToList: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: tokens.spacing4, paddingBottom: 0 },
  backToListText: { fontSize: 13, fontWeight: '600' },

  // Reason modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: tokens.spacing5 },
  modalDialog: { width: '100%', maxWidth: 340, borderRadius: tokens.radiusLg, padding: tokens.spacing5, alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: tokens.spacing2 },
  modalMsg: { fontSize: 14, textAlign: 'center', marginBottom: tokens.spacing4 },
  modalInput: { width: '100%', borderWidth: 1, borderRadius: tokens.radiusMd, paddingHorizontal: tokens.spacing3, paddingVertical: tokens.spacing3, fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: tokens.spacing4 },
  modalActions: { flexDirection: 'row', gap: tokens.spacing3, width: '100%' },
  modalBtn: { flex: 1, borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing3, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});