import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { auditApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

// ─── Action label + color config ──────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string; bg: string; category: string }> = {
  otp_requested:           { label: 'OTP Requested',        color: '#6366f1', bg: '#eef2ff', category: 'Auth' },
  otp_verified:            { label: 'OTP Verified',          color: '#059669', bg: '#d1fae5', category: 'Auth' },
  otp_expired:             { label: 'OTP Expired',           color: '#9ca3af', bg: '#f3f4f6', category: 'Auth' },
  user_registered:         { label: 'User Registered',       color: '#0891b2', bg: '#e0f2fe', category: 'User' },
  user_profile_updated:    { label: 'Profile Updated',       color: '#7c3aed', bg: '#ede9fe', category: 'User' },
  user_suspended:          { label: 'User Suspended',        color: '#d97706', bg: '#fef3c7', category: 'User' },
  user_banned:             { label: 'User Banned',           color: '#dc2626', bg: '#fee2e2', category: 'User' },
  user_unsuspended:        { label: 'User Unsuspended',      color: '#059669', bg: '#d1fae5', category: 'User' },
  user_unbanned:           { label: 'User Unbanned',         color: '#059669', bg: '#d1fae5', category: 'User' },
  user_verified:           { label: 'User Verified',         color: '#059669', bg: '#d1fae5', category: 'User' },
  question_submitted:      { label: 'Question Submitted',    color: '#0891b2', bg: '#e0f2fe', category: 'Question' },
  question_approved:       { label: 'Question Approved',     color: '#059669', bg: '#d1fae5', category: 'Question' },
  question_rejected:       { label: 'Question Rejected',     color: '#dc2626', bg: '#fee2e2', category: 'Question' },
  reward_credited:         { label: 'Reward Credited',       color: '#059669', bg: '#d1fae5', category: 'Wallet' },
  withdrawal_requested:    { label: 'Withdrawal Requested',  color: '#d97706', bg: '#fef3c7', category: 'Wallet' },
  withdrawal_completed:    { label: 'Withdrawal Completed',  color: '#059669', bg: '#d1fae5', category: 'Wallet' },
  withdrawal_approved:     { label: 'Withdrawal Approved',   color: '#059669', bg: '#d1fae5', category: 'Wallet' },
  withdrawal_rejected:     { label: 'Withdrawal Rejected',   color: '#dc2626', bg: '#fee2e2', category: 'Wallet' },
  withdrawal_retry:        { label: 'Withdrawal Retried',    color: '#d97706', bg: '#fef3c7', category: 'Wallet' },
  admin_config_updated:    { label: 'Config Updated',        color: '#6b7280', bg: '#f3f4f6', category: 'Config' },
};

const CATEGORY_OPTIONS = [
  { key: '', label: 'All Categories' },
  { key: 'Auth', label: 'Auth' },
  { key: 'User', label: 'User' },
  { key: 'Question', label: 'Question' },
  { key: 'Wallet', label: 'Wallet' },
  { key: 'Config', label: 'Config' },
];

const ENTITY_OPTIONS = [
  { key: '', label: 'All Entities' },
  { key: 'User', label: 'User' },
  { key: 'Question', label: 'Question' },
  { key: 'WithdrawalRequest', label: 'Withdrawal' },
  { key: 'AdminConfig', label: 'Config' },
];

const ALL_ACTIONS = Object.keys(ACTION_META).map((k) => ({ key: k, label: ACTION_META[k].label }));

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface FilterState {
  category: string;
  entityType: string;
  action: string;
  search: string;
  fromDate: string;
  toDate: string;
}

// ─── Super Admin types ────────────────────────────────────────────────────────

interface ActorStats {
  actorId: string;
  actorName: string;
  actorRole: string;
  withdrawalApproved: number;
  withdrawalRejected: number;
  withdrawalProcessed: number;
  withdrawalRetried: number;
  userSuspended: number;
  userBanned: number;
  userUnsuspended: number;
  userUnbanned: number;
  userVerified: number;
  questionApproved: number;
  questionRejected: number;
  questionHeld: number;
  configUpdated: number;
  totalActions: number;
}

interface SummaryPoint {
  date: string;
  withdrawals: number;
  userActions: number;
  questionReviews: number;
  configChanges: number;
  total: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function getMeta(action: string) {
  return ACTION_META[action] ?? { label: action, color: '#6b7280', bg: '#f3f4f6', category: 'Other' };
}

// ─── Super Admin helpers ─────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function KpiCard({
  label,
  value,
  gradient,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  gradient: [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  sub?: string;
}) {
  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={kpiStyles.card}>
      <View style={kpiStyles.topRow}>
        <View style={kpiStyles.iconBox}>
          <Ionicons name={icon} size={14} color="#FFFFFF" />
        </View>
        {sub && <Text style={kpiStyles.sub}>{sub}</Text>}
      </View>
      <Text style={kpiStyles.value}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
    </LinearGradient>
  );
}

function SectionHeader({ title, icon, themeColors }: { title: string; icon: keyof typeof Ionicons.glyphMap; themeColors: any }) {
  return (
    <View style={sectionHeaderStyles.row}>
      <View style={sectionHeaderStyles.titleRow}>
        <View style={[sectionHeaderStyles.iconWrap, { backgroundColor: themeColors.primary + '18' }]}>
          <Ionicons name={icon} size={13} color={themeColors.primary} />
        </View>
        <Text style={[sectionHeaderStyles.title, { color: themeColors.foreground }]}>{title}</Text>
      </View>
    </View>
  );
}

function ActorRow({ actor, themeColors }: { actor: ActorStats; themeColors: any }) {
  return (
    <View style={[arStyles.row, { borderBottomColor: themeColors.border }]}>
      <View style={arStyles.avatar}>
        <Text style={arStyles.avatarText}>
          {(actor.actorName ?? actor.actorId).charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={arStyles.info}>
        <Text style={[arStyles.name, { color: themeColors.foreground }]}>
          {actor.actorName ?? actor.actorId}
        </Text>
        <Text style={[arStyles.role, { color: themeColors.mutedForeground }]}>
          {actor.actorRole}
        </Text>
      </View>
      <View style={arStyles.stats}>
        <View style={[arStyles.statChip, { backgroundColor: '#05966918' }]}>
          <Text style={[arStyles.statVal, { color: '#059669' }]}>{actor.questionApproved}</Text>
          <Text style={[arStyles.statLbl, { color: '#05966988' }]}>AP</Text>
        </View>
        <View style={[arStyles.statChip, { backgroundColor: '#dc262618' }]}>
          <Text style={[arStyles.statVal, { color: '#dc2626' }]}>{actor.questionRejected}</Text>
          <Text style={[arStyles.statLbl, { color: '#dc262688' }]}>RJ</Text>
        </View>
        <View style={[arStyles.statChip, { backgroundColor: themeColors.primary + '15' }]}>
          <Text style={[arStyles.statVal, { color: themeColors.primary }]}>{actor.totalActions}</Text>
          <Text style={[arStyles.statLbl, { color: themeColors.primary + '88' }]}>TOT</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  onPress,
  onClear,
  active,
}: {
  label: string;
  onPress: () => void;
  onClear?: () => void;
  active?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity
      style={[
        pillStyles.pill,
        { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + '12' : c.surface },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[pillStyles.pillText, { color: active ? c.primary : c.text }]}>{label}</Text>
      {active && onClear && (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
          <Ionicons name="close-circle" size={13} color={c.primary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Log entry card ───────────────────────────────────────────────────────────

function LogCard({
  item,
  onExpand,
  expanded,
  themeColors,
}: {
  item: AuditLogEntry;
  onExpand: () => void;
  expanded: boolean;
  themeColors: any;
}) {
  const meta = getMeta(item.action);

  return (
    <TouchableOpacity
      style={[cardStyles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
      onPress={onExpand}
      activeOpacity={0.75}
    >
      {/* Header row */}
      <View style={cardStyles.header}>
        <View style={[cardStyles.actionBadge, { backgroundColor: meta.bg }]}>
          <View style={[cardStyles.dot, { backgroundColor: meta.color }]} />
          <Text style={[cardStyles.actionText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={cardStyles.headerRight}>
          <View style={[cardStyles.categoryPill, { backgroundColor: themeColors.muted + '44' }]}>
            <Text style={[cardStyles.categoryText, { color: themeColors.mutedForeground }]}>{meta.category}</Text>
          </View>
          <Text style={[cardStyles.time, { color: themeColors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={themeColors.mutedForeground}
          />
        </View>
      </View>

      {/* Actor + entity row */}
      <View style={cardStyles.metaRow}>
        <Ionicons name="person" size={11} color={themeColors.mutedForeground} />
        <Text style={[cardStyles.metaText, { color: themeColors.mutedForeground }]}>
          {item.actorName
            ? `${item.actorName}${item.actorRole ? ` (${item.actorRole})` : ''}`
            : `${item.actorType ?? 'System'} ${item.actorId ? `#${item.actorId.slice(0, 8)}` : ''}`}
        </Text>
        {item.entityType && (
          <>
            <Text style={[cardStyles.metaSep, { color: themeColors.border }]}>·</Text>
            <Ionicons name="cube" size={11} color={themeColors.mutedForeground} />
            <Text style={[cardStyles.metaText, { color: themeColors.mutedForeground }]}>
              {item.entityType} {item.entityId ? `#${item.entityId.slice(0, 8)}` : ''}
            </Text>
          </>
        )}
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={[cardStyles.expanded, { borderTopColor: themeColors.border }]}>
          {/* Old → New values */}
          {(item.oldValue || item.newValue) && (
            <View style={cardStyles.diffBlock}>
              {item.oldValue && (
                <>
                  <Text style={[cardStyles.diffLabel, { color: themeColors.mutedForeground }]}>Previous</Text>
                  <View style={[cardStyles.diffBox, { backgroundColor: '#fee2e220' }]}>
                    <Text style={[cardStyles.diffText, { color: '#991b1b' }]}>
                      {JSON.stringify(item.oldValue, null, 2)}
                    </Text>
                  </View>
                </>
              )}
              {item.newValue && (
                <>
                  <Text style={[cardStyles.diffLabel, { color: themeColors.mutedForeground }]}>New</Text>
                  <View style={[cardStyles.diffBox, { backgroundColor: '#d1fae520' }]}>
                    <Text style={[cardStyles.diffText, { color: '#065f46' }]}>
                      {JSON.stringify(item.newValue, null, 2)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
          {/* Metadata */}
          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <>
              <Text style={[cardStyles.diffLabel, { color: themeColors.mutedForeground }]}>Metadata</Text>
              <View style={[cardStyles.diffBox, { backgroundColor: themeColors.muted + '22' }]}>
                <Text style={[cardStyles.diffText, { color: themeColors.foreground }]}>
                  {JSON.stringify(item.metadata, null, 2)}
                </Text>
              </View>
            </>
          )}
          {/* Timestamp */}
          <Text style={[cardStyles.timestamp, { color: themeColors.mutedForeground }]}>
            {new Date(item.createdAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Filter modal ─────────────────────────────────────────────────────────────

function FilterModal({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (f: FilterState) => void;
  onReset: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [local, setLocal] = useState<FilterState>(filters);

  useEffect(() => { setLocal(filters); }, [filters, visible]);

  const sections: Array<{ title: string; options: Array<{ key: string; label: string }> }> = [
    { title: 'Category', options: CATEGORY_OPTIONS },
    { title: 'Entity', options: ENTITY_OPTIONS },
    { title: 'Action Type', options: [{ key: '', label: 'All Actions' }, ...ALL_ACTIONS] },
  ];

  function toggle(field: keyof FilterState, value: string) {
    setLocal((prev) => ({ ...prev, [field]: prev[field] === value ? '' : value }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[fmStyles.overlay]}>
        <View style={[fmStyles.sheet, { backgroundColor: c.background }]}>
          <View style={fmStyles.sheetHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={c.text} />
            </TouchableOpacity>
            <Text style={[fmStyles.sheetTitle, { color: c.text }]}>Filter Audit Logs</Text>
            <TouchableOpacity onPress={() => { onReset(); onClose(); }}>
              <Text style={[fmStyles.resetText, { color: c.primary }]}>Reset</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={sections}
            keyExtractor={(s) => s.title}
            contentContainerStyle={{ padding: tokens.spacing5 }}
            renderItem={({ item: section }) => (
              <View style={{ marginBottom: tokens.spacing5 }}>
                <Text style={[fmStyles.sectionTitle, { color: c.text }]}>{section.title}</Text>
                <View style={fmStyles.optionGrid}>
                  {section.options.map((opt) => {
                    const active = local[section.title === 'Category' ? 'category'
                      : section.title === 'Entity' ? 'entityType' : 'action'] === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[fmStyles.optionChip, {
                          backgroundColor: active ? c.primary + '15' : c.surface,
                          borderColor: active ? c.primary : c.border,
                        }]}
                        onPress={() => toggle(
                          section.title === 'Category' ? 'category'
                            : section.title === 'Entity' ? 'entityType' : 'action',
                          opt.key,
                        )}
                      >
                        <Text style={[fmStyles.optionText, { color: active ? c.primary : c.text }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            ListFooterComponent={
              <TouchableOpacity
                style={[fmStyles.applyBtn, { backgroundColor: c.primary }]}
                onPress={() => { onApply(local); onClose(); }}
              >
                <Text style={fmStyles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    minHeight: 105,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  sub: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  value: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', lineHeight: 28 },
  label: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
});

const sectionHeaderStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spacing3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 24, height: 24, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700' },
});

const arStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing3,
    paddingVertical: tokens.spacing3, borderBottomWidth: 1,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#0891b230', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: '#0891b2' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  role: { fontSize: 11, textTransform: 'capitalize' },
  stats: { flexDirection: 'row', gap: 4 },
  statChip: {
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    alignItems: 'center',
  },
  statVal: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
  statLbl: { fontSize: 9, fontWeight: '700' },
});

const chartStyles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    gap: tokens.spacing2,
    paddingBottom: tokens.spacing2,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barVal: { fontSize: 9, fontWeight: '600' },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 3,
  },
  barLbl: { fontSize: 10, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing3,
    marginTop: tokens.spacing3,
    paddingTop: tokens.spacing3,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
});

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing2,
    ...tokens.shadowSm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  actionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actionText: { fontSize: 12, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryPill: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  categoryText: { fontSize: 10, fontWeight: '600' },
  time: { fontSize: 11 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 11.5 },
  metaSep: { fontSize: 12 },
  expanded: {
    marginTop: tokens.spacing3,
    paddingTop: tokens.spacing3,
    borderTopWidth: 1,
  },
  diffBlock: { marginBottom: tokens.spacing2 },
  diffLabel: { fontSize: 10, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  diffBox: { borderRadius: tokens.radius, padding: tokens.spacing2, marginBottom: 4 },
  diffText: { fontSize: 11, fontFamily: 'Courier' },
  timestamp: { fontSize: 10, marginTop: 4, textAlign: 'right' },
});

const fmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: tokens.spacing5, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  resetText: { fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: tokens.spacing2, textTransform: 'uppercase', letterSpacing: 0.5 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  optionChip: {
    borderWidth: 1, borderRadius: tokens.radius,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  optionText: { fontSize: 13, fontWeight: '500' },
  applyBtn: {
    borderRadius: tokens.radiusMd, padding: tokens.spacing4,
    alignItems: 'center', marginTop: tokens.spacing3,
  },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const EMPTY_FILTERS: FilterState = {
  category: '',
  entityType: '',
  action: '',
  search: '',
  fromDate: '',
  toDate: '',
};

function buildQuery(filters: FilterState, page: number): Record<string, string | number> {
  const q: Record<string, string | number> = { page, limit: 30 };
  if (filters.category) {
    const catActions = Object.entries(ACTION_META)
      .filter(([, v]) => v.category === filters.category)
      .map(([k]) => k);
    if (catActions.length) q.actions = catActions.join(',');
  }
  if (filters.entityType) q.entityType = filters.entityType;
  if (filters.action) q.action = filters.action;
  if (filters.search) q.search = filters.search;
  if (filters.fromDate) q.fromDate = filters.fromDate;
  if (filters.toDate) q.toDate = filters.toDate;
  return q;
}

export function AdminAuditLogsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Super admin state
  const [actorStats, setActorStats] = useState<{ actors: ActorStats[]; summary: { totalActions: number; uniqueActors: number } } | null>(null);
  const [summary, setSummary] = useState<{ series: SummaryPoint[] } | null>(null);
  const [superLoading, setSuperLoading] = useState(true);

  const fetch = useCallback(async (pageNum = 1, refresh = false, f: FilterState = filters) => {
    try {
      const res = await auditApi.getAuditLogs(buildQuery(f, pageNum));
      const data = res.data;
      const items: AuditLogEntry[] = data.items ?? [];
      setLogs((prev) => {
        const next = refresh ? items : [...prev, ...items];
        // Deduplicate by id in case of race conditions
        const seen = new Set<string>();
        return next.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      setTotal(data.total ?? 0);
      setHasMore(items.length === 30);
      setPage(pageNum);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load audit logs'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  const fetchSuper = useCallback(async () => {
    try {
      const [statsRes, summaryRes] = await Promise.all([
        auditApi.getActorStats({}),
        auditApi.getSummary({ granularity: 'day' }),
      ]);
      setActorStats(statsRes.data);
      setSummary(summaryRes.data);
    } catch {
      // non-critical, just hide the section
    } finally {
      setSuperLoading(false);
    }
  }, []);

  useEffect(() => { fetch(1, true, filters); }, [filters]);
  useEffect(() => {
    if (user?.role === 'super_admin') fetchSuper();
    else setSuperLoading(false);
  }, [fetchSuper, user?.role]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch(1, true, filters);
    if (user?.role === 'super_admin') {
      setSuperLoading(true);
      await fetchSuper();
    }
  }

  async function loadMore() {
    if (!hasMore || loading) return;
    await fetch(page + 1, false, filters);
  }

  function handleApplyFilters(f: FilterState) {
    setFilters(f);
    setPage(1);
    setLogs([]);
    setLoading(true);
    fetch(1, true, f);
  }

  function handleResetFilters() {
    setFilters(EMPTY_FILTERS);
    setSearchText('');
    setPage(1);
    setLogs([]);
    setLoading(true);
    fetch(1, true, EMPTY_FILTERS);
  }

  function activeFilterCount(): number {
    return Object.values(filters).filter((v) => v && v.length > 0).length;
  }

  const countBadge = activeFilterCount();
  const isSuperAdmin = user?.role === 'super_admin';

  const actors = actorStats?.actors ?? [];
  const topActors = actors.slice(0, 5);
  const totalActions = actorStats?.summary?.totalActions ?? 0;
  const uniqueActors = actorStats?.summary?.uniqueActors ?? 0;
  const recentSeries = summary?.series?.slice(-7) ?? [];
  const maxDayTotal = Math.max(...recentSeries.map((d) => d.total), 1);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: tokens.spacing8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: c.text }]}>Audit Logs</Text>
          <Text style={[styles.count, { color: c.textSecondary }]}>{total.toLocaleString()} entries</Text>
          <TouchableOpacity
            style={[styles.filterBtn, { backgroundColor: countBadge > 0 ? c.primary + '18' : c.surfaceVariant }]}
            onPress={() => setFilterVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options" size={18} color={countBadge > 0 ? c.primary : c.textSecondary} />
            {countBadge > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: c.primary }]}>
                <Text style={styles.filterBadgeText}>{countBadge}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Super Admin section */}
        {isSuperAdmin && !superLoading && (
          <>
            {/* Hero */}
            <View style={[styles.hero, { backgroundColor: c.heroBg }]}>
              <View style={styles.heroTop}>
                <View style={styles.heroLeft}>
                  <Text style={[styles.heroGreeting, { color: c.heroFg + 'bb' }]}>
                    {(() => {
                      const h = new Date().getHours();
                      if (h < 12) return 'Good morning';
                      if (h < 17) return 'Good afternoon';
                      return 'Good evening';
                    })()}
                  </Text>
                  <Text style={[styles.heroName, { color: c.heroFg }]}>{user?.name ?? 'Super Admin'}</Text>
                  <View style={[styles.heroRolePill, { backgroundColor: c.heroFg + '22' }]}>
                    <Ionicons name="shield" size={13} color={c.heroFg} />
                    <Text style={[styles.heroRoleText, { color: c.heroFg + 'dd' }]}>Super Administrator</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Global KPIs */}
            <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
              <SectionHeader title="Activity Overview" icon="analytics" themeColors={c} />
              <View style={styles.kpiRow}>
                <KpiCard
                  label="Total Actions"
                  value={fmtNum(totalActions)}
                  gradient={['#4f46e5', '#7c3aed']}
                  icon="flash"
                  sub="All time"
                />
                <KpiCard
                  label="Active Admins"
                  value={String(uniqueActors)}
                  gradient={['#0891b2', '#0e7490']}
                  icon="people"
                  sub="Last 30 days"
                />
              </View>
              <View style={styles.kpiRow}>
                <KpiCard
                  label="Config Changes"
                  value={fmtNum(actors.reduce((s, a) => s + a.configUpdated, 0))}
                  gradient={['#6b7280', '#4b5563']}
                  icon="settings"
                />
                <KpiCard
                  label="Users Banned"
                  value={fmtNum(actors.reduce((s, a) => s + a.userBanned, 0))}
                  gradient={['#dc2626', '#991b1b']}
                  icon="person-remove"
                />
              </View>
            </View>

            {/* Activity chart */}
            {recentSeries.length > 0 && (
              <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
                <SectionHeader title="Daily Activity (Last 7 Days)" icon="bar-chart" themeColors={c} />
                <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={chartStyles.bars}>
                    {recentSeries.map((day) => {
                      const pct = (day.total / maxDayTotal) * 100;
                      const label = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
                      return (
                        <View key={day.date} style={chartStyles.barCol}>
                          <Text style={[chartStyles.barVal, { color: c.mutedForeground }]}>
                            {fmtNum(day.total)}
                          </Text>
                          <View style={chartStyles.barTrack}>
                            <View
                              style={[
                                chartStyles.barFill,
                                { height: `${Math.max(pct, 2)}%`, backgroundColor: c.primary },
                              ]}
                            />
                          </View>
                          <Text style={[chartStyles.barLbl, { color: c.mutedForeground }]}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={chartStyles.legend}>
                    {[
                      { color: '#059669', label: 'Withdrawals' },
                      { color: '#0891b2', label: 'User Actions' },
                      { color: '#7c3aed', label: 'Question Reviews' },
                      { color: '#6b7280', label: 'Config' },
                    ].map((l) => (
                      <View key={l.label} style={chartStyles.legendItem}>
                        <View style={[chartStyles.legendDot, { backgroundColor: l.color }]} />
                        <Text style={[chartStyles.legendText, { color: c.mutedForeground }]}>{l.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Top performers */}
            {topActors.length > 0 && (
              <View style={[styles.section, { marginTop: tokens.spacing5 }]}>
                <SectionHeader title="Moderation Leaderboard" icon="trophy" themeColors={c} />
                <View style={[styles.leaderboard, { backgroundColor: c.card, borderColor: c.border }]}>
                  {topActors.map((actor) => (
                    <ActorRow key={actor.actorId} actor={actor} themeColors={c} />
                  ))}
                </View>
              </View>
            )}

            {/* Audit log entries section */}
            <View style={styles.section}>
              <View style={[styles.logsDivider, { borderTopColor: c.border }]} />
              <View style={styles.logsSectionHeader}>
                <SectionHeader title="Audit Logs" icon="document-text" themeColors={c} />
              </View>
            </View>
          </>
        )}

        {/* Active filter pills */}
        {countBadge > 0 && (
          <View style={[styles.filterRow, { borderBottomColor: c.border }]}>
            {filters.category && (
              <FilterPill
                label={CATEGORY_OPTIONS.find((o) => o.key === filters.category)?.label ?? filters.category}
                onPress={() => handleApplyFilters({ ...filters, category: '' })}
                onClear={() => handleApplyFilters({ ...filters, category: '' })}
                active
              />
            )}
            {filters.entityType && (
              <FilterPill
                label={ENTITY_OPTIONS.find((o) => o.key === filters.entityType)?.label ?? filters.entityType}
                onPress={() => handleApplyFilters({ ...filters, entityType: '' })}
                onClear={() => handleApplyFilters({ ...filters, entityType: '' })}
                active
              />
            )}
            {filters.action && (
              <FilterPill
                label={ALL_ACTIONS.find((a) => a.key === filters.action)?.label ?? filters.action}
                onPress={() => handleApplyFilters({ ...filters, action: '' })}
                onClear={() => handleApplyFilters({ ...filters, action: '' })}
                active
              />
            )}
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={[styles.clearAll, { color: c.primary }]}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LogCard
              item={item}
              expanded={expandedId === item.id}
              onExpand={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
              themeColors={c}
            />
          )}
          contentContainerStyle={styles.list}
          scrollEnabled={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={c.textTertiary} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {loading ? '' : 'No audit logs found'}
              </Text>
              {!loading && (
                <Text style={[styles.emptyMsg, { color: c.textSecondary }]}>
                  {countBadge > 0 ? 'Try adjusting your filters' : 'Logs will appear here as actions are performed'}
                </Text>
              )}
            </View>
          }
          ListFooterComponent={
            loading && logs.length > 0 ? (
              <View style={{ padding: tokens.spacing4, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={c.primary} />
              </View>
            ) : null
          }
        />
      </ScrollView>

      <FilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        filters={filters}
        onApply={handleApplyFilters}
        onReset={() => { handleResetFilters(); setFilterVisible(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: tokens.spacing5, paddingBottom: tokens.spacing3,
    gap: tokens.spacing2,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', flex: 1 },
  count: { fontSize: 13 },
  filterBtn: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2,
    paddingHorizontal: tokens.spacing5, paddingBottom: tokens.spacing3,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  clearAll: { fontSize: 12, fontWeight: '600' },
  list: { padding: tokens.spacing5, paddingTop: tokens.spacing3 },
  empty: { alignItems: 'center', marginTop: 80, gap: tokens.spacing3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: tokens.spacing2 },
  emptyMsg: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
  // Super admin styles
  hero: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: tokens.spacing5,
    paddingBottom: tokens.spacing6,
    paddingHorizontal: tokens.spacing5,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { gap: 4 },
  heroGreeting: { fontSize: 13 },
  heroName: { fontSize: 24, fontWeight: '800' },
  heroRolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginTop: 4,
  },
  heroRoleText: { fontSize: 12, fontWeight: '700' },
  section: { paddingHorizontal: tokens.spacing5 },
  kpiRow: { flexDirection: 'row', gap: tokens.spacing3, marginBottom: tokens.spacing3 },
  chartCard: {
    borderRadius: tokens.radiusLg, borderWidth: 1,
    padding: tokens.spacing4, ...tokens.shadowSm,
  },
  leaderboard: {
    borderRadius: tokens.radiusLg, borderWidth: 1,
    padding: tokens.spacing4, ...tokens.shadowSm,
  },
  logsDivider: {
    borderTopWidth: 1,
    marginTop: tokens.spacing5,
    marginHorizontal: tokens.spacing5,
  },
  logsSectionHeader: {
    paddingHorizontal: tokens.spacing5,
    marginTop: tokens.spacing3,
  },
});