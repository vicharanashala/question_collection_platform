import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { SuspendBanModal } from '../../components/SuspendBanModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { WalletAdjustModal } from '../../components/WalletAdjustModal';
import { adminApi, auditApi, getErrorMessage, AccountLockedInfo } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AdminStackParamList } from '../../navigation/types';
import { UserRole } from '../../types';

const PRIVILEGED_ROLES = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR];
type Route = RouteProp<AdminStackParamList, 'AdminUserDetail'>;

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', ai_review: '#8b5cf6', human_review: '#ec4899',
  approved: '#22c55e', rejected: '#ef4444',
};
function statusColor(s: string) { return STATUS_COLORS[s] ?? '#6b7280'; }

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
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [suspendModalAction, setSuspendModalAction] = useState<'suspend' | 'ban'>('suspend');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalAction, setConfirmModalAction] = useState<'unsuspend' | 'unban'>('unsuspend');
  const [walletAdjustVisible, setWalletAdjustVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [auditCollapsed, setAuditCollapsed] = useState(true);
  const [auditEntries, setAuditEntries] = useState<Array<{
    id: string; actorType: string; actorId: string | null; actorName?: string | null;
    actorRole?: string | null; action: string; oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null; createdAt: string;
  }>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 10;
  useEffect(() => {
    adminApi.getUserDetail(userId)
      .then((r) => setData(r.data))
      .catch((e) => showToast(getErrorMessage(e, 'Failed to load user'), 'error'))
      .finally(() => setLoading(false));
  }, [userId]);

  const user = data?.user as Record<string, unknown> | undefined;

  // Fetch wallet balance for super admin on non-privileged users
  useEffect(() => {
    if (!isSuperAdmin || PRIVILEGED_ROLES.includes(user?.role as UserRole)) return;
    setWalletLoading(true);
    adminApi.getUserWallet(userId)
      .then((r) => setWalletBalance((r.data as { balance?: number }).balance ?? 0))
      .catch(() => setWalletBalance(0))
      .finally(() => setWalletLoading(false));
  }, [userId, user?.role, isSuperAdmin]);
  const verificationStatus = String(user?.verificationStatus ?? '');
  const isSuspended = verificationStatus === 'suspended';
  const isBanned = verificationStatus === 'banned';
  const isLocked = isSuspended || isBanned;
  const isPending = verificationStatus === 'pending';

  const currentStatus: AccountLockedInfo | null = isLocked
    ? {
        status: isBanned ? 'banned' : 'suspended',
        reason: (user?.suspendedReason ?? user?.bannedReason ?? null) as string | null,
        suspendedAt: (user?.suspendedAt as string | null) ?? null,
        bannedAt: (user?.bannedAt as string | null) ?? null,
        suspendedUntil: (user?.suspendedUntil as string | null) ?? null,
      }
    : null;

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return null; }
  };

  const formatRelativeDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'expires today';
      if (diffDays === 1) return 'expires tomorrow';
      if (diffDays < 7) return `expires in ${diffDays} days`;
      if (diffDays < 30) return `expires in ${Math.ceil(diffDays / 7)} weeks`;
      return `expires in ${Math.ceil(diffDays / 30)} months`;
    } catch { return null; }
  };

  const getInitials = (name: string, mobile: string) => {
    const n = String(name || mobile || '?');
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  function handleSuspendBan(action: 'suspend' | 'ban') {
    setSuspendModalAction(action);
    setSuspendModalVisible(true);
  }

  function openUnsuspendConfirm(action: 'unsuspend' | 'unban') {
    setConfirmModalAction(action);
    setConfirmModalVisible(true);
  }

  async function handleSuspendConfirm(reason: string, suspendedUntil?: string) {
    setActionLoading(true);
    try {
      await adminApi.suspendUser(userId, { action: suspendModalAction, reason, suspendedUntil });
      showToast(`User ${suspendModalAction === 'ban' ? 'banned' : 'suspended'}`, 'success');
      setSuspendModalVisible(false);
      const r = await adminApi.getUserDetail(userId);
      setData(r.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? `Failed to ${suspendModalAction}`, 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnsuspendConfirm() {
    setActionLoading(true);
    setConfirmModalVisible(false);
    try {
      await adminApi.unsuspendUser(userId);
      showToast(
        confirmModalAction === 'unban' ? 'User unbanned successfully' : 'Suspension lifted successfully',
        'success',
      );
      const r = await adminApi.getUserDetail(userId);
      setData(r.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Failed to reinstate user', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVerifyUser() {
    setActionLoading(true);
    try {
      await adminApi.verifyUser(userId);
      showToast('User verified successfully', 'success');
      const r = await adminApi.getUserDetail(userId);
      setData(r.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Failed to verify user', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function loadAuditHistory() {
    if (auditEntries.length > 0) {
      setAuditCollapsed((c) => !c);
      return;
    }
    setAuditLoading(true);
    try {
      const res = await auditApi.getEntityHistory('user', userId);
      setAuditEntries((res.data as { entries: typeof auditEntries }).entries);
      setAuditCollapsed(false);
      setAuditPage(1);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load audit history'), 'error');
    } finally {
      setAuditLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!data || !user) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><Text style={{ color: c.text }}>User not found</Text></View>
      </SafeAreaView>
    );
  }

  const { questions } = data;
  const userName = String(user.name || user.mobileNumber || 'Unknown');
  const initials = getInitials(String(user.name ?? ''), String(user.mobileNumber ?? ''));

  // Avatar background color from name hash
  const avatarBg = isBanned ? c.error : isSuspended ? c.warning : c.primary;
  const statusBg = isBanned ? c.error + '18' : isSuspended ? c.warning + '18' : c.success + '18';
  const statusIcon = isBanned ? 'ban' : isSuspended ? 'pause-circle' : verificationStatus === 'pending' ? 'time' : 'checkmark-circle';
  const statusIconColor = isBanned ? c.error : isSuspended ? c.warning : c.success;
  const statusLabel = isBanned ? 'Permanently Banned' : isSuspended ? 'Suspended' : verificationStatus === 'pending' ? 'Pending Verification' : 'Verified';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header bar */}
      <View style={[styles.headerBar, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>User Detail</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll} contentContainerStyle={styles.badgeScrollContent}>
          <View style={[styles.pill, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="shield-checkmark" size={13} color={c.primary} />
            <Text style={[styles.pillText, { color: c.primary }]}>{String(user.role).replace('_', ' ')}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: statusBg }]}>
            <Ionicons name={statusIcon as any} size={13} color={statusIconColor} />
            <Text style={[styles.pillText, { color: statusIconColor }]}>{statusLabel}</Text>
          </View>
          {!!user.category && (
            <View style={[styles.pill, { backgroundColor: c.textTertiary + '18' }]}>
              <Text style={[styles.pillText, { color: c.textSecondary }]}>{String(user.category)}</Text>
            </View>
          )}
        </ScrollView>

        {/* Hero card */}
        <View style={[styles.heroCard, { backgroundColor: c.surface }]}>
          <View style={[styles.avatar, { backgroundColor: avatarBg + '22' }]}>
            <Text style={[styles.avatarText, { color: avatarBg }]}>{initials}</Text>
          </View>
          <View style={styles.heroMeta}>
            <Text style={[styles.heroName, { color: c.text }]}>{userName}</Text>
            <View style={styles.heroDetailRow}>
              <Ionicons name="call-outline" size={13} color={c.textTertiary} />
              <Text style={[styles.heroDetail, { color: c.textSecondary }]}>{String(user.mobileNumber)}</Text>
            </View>
            {(!!user.district || !!user.state) && (
              <View style={styles.heroDetailRow}>
                <Ionicons name="location-outline" size={13} color={c.textTertiary} />
                <Text style={[styles.heroDetail, { color: c.textSecondary }]}>
                  {[String(user.district ?? ''), String(user.state ?? '')].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Lock alert — only when locked */}
        {isLocked && (
          <View style={[styles.alertCard, { backgroundColor: (isBanned ? c.error : c.warning) + '12', borderColor: (isBanned ? c.error : c.warning) + '40' }]}>
            <View style={styles.alertHeader}>
              <Ionicons
                name={isBanned ? 'alert-circle' : 'time'}
                size={22}
                color={isBanned ? c.error : c.warning}
              />
              <Text style={[styles.alertTitle, { color: isBanned ? c.error : c.warning }]}>
                {isBanned ? 'Account Permanently Banned' : 'Account Suspended'}
              </Text>
            </View>
            {currentStatus?.reason && (
              <Text style={[styles.alertReason, { color: c.textSecondary }]}>
                "{currentStatus.reason}"
              </Text>
            )}
            <View style={styles.alertMeta}>
              {currentStatus?.suspendedAt && (
                <View style={styles.alertMetaItem}>
                  <Text style={[styles.alertMetaLabel, { color: c.textTertiary }]}>
                    {isBanned ? 'Banned' : 'Suspended'}
                  </Text>
                  <Text style={[styles.alertMetaValue, { color: c.text }]}>
                    {formatDate(isBanned ? currentStatus.bannedAt : currentStatus.suspendedAt)}
                  </Text>
                </View>
              )}
              {!isBanned && currentStatus?.suspendedUntil && (
                <View style={styles.alertMetaItem}>
                  <Text style={[styles.alertMetaLabel, { color: c.textTertiary }]}>Until</Text>
                  <Text style={[styles.alertMetaValue, { color: c.text }]}>
                    {formatDate(currentStatus.suspendedUntil)}
                    {' '}
                    <Text style={{ color: c.textTertiary, fontSize: 11 }}>
                      ({formatRelativeDate(currentStatus.suspendedUntil)})
                    </Text>
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Account info grid */}
        <Text style={[styles.sectionHeading, { color: c.text }]}>Account Info</Text>
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: c.textTertiary }]}>Language</Text>
              <Text style={[styles.infoValue, { color: c.text }]}>{String(user.languagePreference ?? 'Not set')}</Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: c.border }]} />
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: c.textTertiary }]}>Joined</Text>
              <Text style={[styles.infoValue, { color: c.text }]}>
                {user.createdAt ? new Date(String(user.createdAt)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
              </Text>
            </View>
          </View>
          <View style={[styles.infoRowBorder, { backgroundColor: c.border }]} />
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: c.textTertiary }]}>Last Login</Text>
              <Text style={[styles.infoValue, { color: c.text }]}>
                {user.lastLoginAt
                  ? new Date(String(user.lastLoginAt)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Never'}
              </Text>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: c.border }]} />
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: c.textTertiary }]}>Questions</Text>
              <Text style={[styles.infoValue, { color: c.text }]}>{questions.length}</Text>
            </View>
          </View>
        </View>

        {/* Wallet card — super admin only, for non-privileged users */}
        {isSuperAdmin && !PRIVILEGED_ROLES.includes(user.role as UserRole) && (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={styles.walletRow}>
              <View style={styles.walletInfo}>
                <Text style={[styles.walletLabel, { color: c.textTertiary }]}>Current Balance</Text>
                {walletLoading ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : (
                  <Text style={[styles.walletBalance, { color: c.primary }]}>
                    ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.adjustWalletBtn, { backgroundColor: c.primary + '18' }]}
                onPress={() => setWalletAdjustVisible(true)}
              >
                <Ionicons name="swap-vertical" size={15} color={c.primary} />
                <Text style={[styles.adjustWalletBtnText, { color: c.primary }]}>Adjust</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action cards */}
        {isSuperAdmin && user.role !== 'super_admin' && !isLocked && (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <Text style={[styles.cardSectionTitle, { color: c.text }]}>Admin Actions</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: c.warning + '66', backgroundColor: c.warning + '0e' }]}
                onPress={() => handleSuspendBan('suspend')}
                disabled={actionLoading}
              >
                <Ionicons name="pause-circle-outline" size={20} color={c.warning} />
                <Text style={[styles.actionBtnLabel, { color: c.warning }]}>Suspend</Text>
                <Text style={[styles.actionBtnDesc, { color: c.textTertiary }]}>Temporary lockout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: c.error + '66', backgroundColor: c.error + '0e' }]}
                onPress={() => handleSuspendBan('ban')}
                disabled={actionLoading}
              >
                <Ionicons name="ban-outline" size={20} color={c.error} />
                <Text style={[styles.actionBtnLabel, { color: c.error }]}>Ban</Text>
                <Text style={[styles.actionBtnDesc, { color: c.textTertiary }]}>Permanent removal</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isSuperAdmin && user.role !== 'super_admin' && isLocked && (
          <View style={[styles.card, { backgroundColor: (isBanned ? c.error : c.warning) + '0e', borderColor: (isBanned ? c.error : c.warning) + '40' }]}>
            <Text style={[styles.cardSectionTitle, { color: isBanned ? c.error : c.warning }]}>
              Restore Access
            </Text>
            <Text style={[styles.cardSectionDesc, { color: c.textSecondary }]}>
              {isBanned
                ? 'This user has been permanently banned. You can reverse this action.'
                : 'This user is currently suspended. You can lift the suspension early.'}
            </Text>
            <TouchableOpacity
              style={[styles.reinstateBtn, { backgroundColor: isBanned ? c.error : c.warning }]}
              onPress={() => openUnsuspendConfirm(isBanned ? 'unban' : 'unsuspend')}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name={isBanned ? 'ban' : 'play-circle'} size={18} color="#fff" />
                    <Text style={styles.reinstateBtnText}>
                      {isBanned ? 'Unban User' : 'Lift Suspension'}
                    </Text>
                  </>}
            </TouchableOpacity>
          </View>
        )}

        {isPending && (
          <View style={[styles.card, { backgroundColor: c.success + '0e', borderColor: c.success + '40' }]}>
            <Text style={[styles.cardSectionTitle, { color: c.success }]}>Awaiting Verification</Text>
            <Text style={[styles.cardSectionDesc, { color: c.textSecondary }]}>
              This user has completed registration but is awaiting admin verification.
            </Text>
            <TouchableOpacity
              style={[styles.verifyBtn, { backgroundColor: c.success }]}
              onPress={handleVerifyUser}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.verifyBtnText}>Verify User</Text>
                  </>}
            </TouchableOpacity>
          </View>
        )}

        {/* Questions */}
        {!PRIVILEGED_ROLES.includes(user.role as UserRole) && (
          <>
            <Text style={[styles.sectionHeading, { color: c.text }]}>
              Recent Questions
              <Text style={{ color: c.textTertiary, fontWeight: '400' }}> ({questions.length})</Text>
            </Text>
            {questions.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: c.surface }]}>
                <Ionicons name="chatbubble-outline" size={32} color={c.textTertiary} />
                <Text style={[styles.emptyText, { color: c.textTertiary }]}>No questions submitted yet</Text>
              </View>
            ) : (
              questions.map((q) => {
                const qStatus = String(q.status);
                const qColor = statusColor(qStatus);
                return (
                  <View key={String(q.id)} style={[styles.questionCard, { backgroundColor: c.surface }]}>
                    <View style={styles.questionTopRow}>
                      <View style={[styles.questionStatusDot, { backgroundColor: qColor }]} />
                      <Text style={[styles.questionStatus, { color: qColor }]}>{qStatus.replace('_', ' ')}</Text>
                      <Text style={[styles.questionDate, { color: c.textTertiary }]}>
                        {q.submittedAt
                          ? formatDate(q.submittedAt as string)
                          : ''}
                      </Text>
                    </View>
                    <Text style={[styles.questionText, { color: c.text }]} numberOfLines={2}>
                      {String(q.questionText)}
                    </Text>
                    {!!q.rejectionReason && (
                      <View style={[styles.rejectionBadge, { backgroundColor: c.error + '14' }]}>
                        <Ionicons name="close-circle" size={12} color={c.error} />
                        <Text style={[styles.rejectionText, { color: c.error }]} numberOfLines={1}>
                          {String(q.rejectionReason)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        <View style={{ height: tokens.spacing8 }} />

        {/* ── Audit History (super_admin) ─────────────────── */}
        {isSuperAdmin && (
          <View style={styles.auditSection}>
            <TouchableOpacity
              style={styles.auditToggle}
              onPress={loadAuditHistory}
              activeOpacity={0.7}
            >
              <Ionicons
                name={auditLoading ? 'sync' : 'git-branch-outline'}
                size={15}
                color={c.primary}
              />
              {auditLoading ? (
                <ActivityIndicator size="small" color={c.primary} style={{ marginLeft: 6 }} />
              ) : (
                <Text style={[styles.auditToggleText, { color: c.primary }]}>
                  {auditCollapsed && auditEntries.length === 0
                    ? 'Audit History'
                    : `${auditEntries.length} audit ${auditEntries.length === 1 ? 'entry' : 'entries'}`}
                </Text>
              )}
              {!auditCollapsed && auditEntries.length > 0 && (
                <Text style={[styles.auditCountText, { color: c.textTertiary }]}>
                  {auditEntries.length} total
                </Text>
              )}
            </TouchableOpacity>

            {!auditCollapsed && auditEntries.length === 0 && !auditLoading && (
              <View style={styles.auditEmpty}>
                <Ionicons name="git-branch-outline" size={28} color={c.textTertiary} style={{ opacity: 0.4 }} />
                <Text style={[styles.auditEmptyText, { color: c.textTertiary }]}>
                  No audit history for this user
                </Text>
              </View>
            )}

            {auditLoading && (
              <View style={styles.auditList}>
                {[1, 2, 3].map((_, i) => (
                  <View key={i} style={[styles.auditSkeleton, { backgroundColor: c.surfaceVariant }]} />
                ))}
              </View>
            )}

            {!auditCollapsed && auditEntries.length > 0 && !auditLoading && (
              <>
                <View style={styles.auditList}>
                  {auditEntries
                    .slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE)
                    .map((entry) => (
                      <View
                        key={entry.id}
                        style={[styles.auditRow, { backgroundColor: c.surfaceVariant + '60', borderColor: c.border }]}
                      >
                        <View style={[styles.auditAvatar, { backgroundColor: c.primary + '20' }]}>
                          <Text style={[styles.auditAvatarText, { color: c.primary }]}>
                            {(entry.actorName ?? entry.actorId ?? 'S').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.auditContent}>
                          <Text style={[styles.auditActor, { color: c.text }]}>
                            {entry.actorName
                              ? `${entry.actorName} (${entry.actorRole ?? entry.actorType})`
                              : entry.actorId ?? 'System'}
                          </Text>
                          <View style={[styles.auditBadge, { backgroundColor: c.surfaceVariant }]}>
                            <Text style={[styles.auditAction, { color: c.textSecondary }]}>
                              {entry.action.replace(/_/g, ' ').toLowerCase()}
                            </Text>
                          </View>
                          {entry.oldValue && entry.newValue && (
                            <Text style={[styles.auditDiff, { color: c.textTertiary }]}>
                              {JSON.stringify(entry.oldValue)} → {JSON.stringify(entry.newValue)}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.auditTime, { color: c.textTertiary }]}>
                          {formatDate(entry.createdAt) ?? entry.createdAt.split('T')[0]}
                        </Text>
                      </View>
                    ))}
                </View>

                {auditEntries.length > AUDIT_PAGE_SIZE && (
                  <View style={styles.auditPagination}>
                    <Text style={[styles.auditPaginationInfo, { color: c.textTertiary }]}>
                      {(auditPage - 1) * AUDIT_PAGE_SIZE + 1}–{Math.min(auditPage * AUDIT_PAGE_SIZE, auditEntries.length)} of {auditEntries.length}
                    </Text>
                    <View style={styles.auditPageButtons}>
                      <TouchableOpacity
                        onPress={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={auditPage === 1}
                        style={[styles.auditPageBtn, auditPage === 1 && { opacity: 0.3 }]}
                      >
                        <Ionicons name="chevron-back" size={16} color={c.text} />
                      </TouchableOpacity>
                      <Text style={[styles.auditPageNum, { color: c.textTertiary }]}>{auditPage}</Text>
                      <TouchableOpacity
                        onPress={() => setAuditPage((p) => p + 1)}
                        disabled={auditPage * AUDIT_PAGE_SIZE >= auditEntries.length}
                        style={[styles.auditPageBtn, auditPage * AUDIT_PAGE_SIZE >= auditEntries.length && { opacity: 0.3 }]}
                      >
                        <Ionicons name="chevron-forward" size={16} color={c.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <SuspendBanModal
        visible={suspendModalVisible}
        action={suspendModalAction}
        currentStatus={currentStatus}
        onClose={() => setSuspendModalVisible(false)}
        onConfirm={handleSuspendConfirm}
      />

      <ConfirmModal
        visible={confirmModalVisible}
        title={confirmModalAction === 'unban' ? 'Unban User?' : 'Lift Suspension?'}
        message={
          confirmModalAction === 'unban'
            ? `Are you sure you want to unban ${userName}? This will restore their access to the platform.`
            : `Are you sure you want to lift the suspension for ${userName}? This will restore their access immediately.`
        }
        confirmLabel={confirmModalAction === 'unban' ? 'Unban User' : 'Lift Suspension'}
        cancelLabel="Cancel"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleUnsuspendConfirm}
        onClose={() => setConfirmModalVisible(false)}
      />

      <WalletAdjustModal
        visible={walletAdjustVisible}
        userId={userId}
        userName={userName}
        onClose={() => setWalletAdjustVisible(false)}
        onAdjusted={() => {
          setWalletAdjustVisible(false);
          adminApi.getUserWallet(userId)
            .then((r) => setWalletBalance((r.data as { balance?: number }).balance ?? 0))
            .catch(() => null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing5,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  scroll: { paddingHorizontal: tokens.spacing5, paddingTop: tokens.spacing4 },
  badgeScroll: { marginBottom: tokens.spacing3 },
  badgeScrollContent: { flexDirection: 'row', gap: tokens.spacing2, paddingRight: tokens.spacing5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  // Hero card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing4,
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  heroMeta: { flex: 1, gap: 4 },
  heroName: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  heroDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroDetail: { fontSize: 13 },

  // Alert card
  alertCard: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginBottom: tokens.spacing2 },
  alertTitle: { fontSize: 14, fontWeight: '700' },
  alertReason: { fontSize: 13, fontStyle: 'italic', marginBottom: tokens.spacing3, paddingLeft: tokens.spacing1 },
  alertMeta: { flexDirection: 'row', gap: tokens.spacing6 },
  alertMetaItem: { gap: 2 },
  alertMetaLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  alertMetaValue: { fontSize: 13, fontWeight: '600' },

  // Section heading
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: tokens.spacing2,
    marginTop: tokens.spacing1,
  },

  // Generic card
  card: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  cardSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: tokens.spacing1 },
  cardSectionDesc: { fontSize: 13, lineHeight: 18, marginBottom: tokens.spacing3 },

  // Info grid
  infoRow: { flexDirection: 'row', alignItems: 'stretch' },
  infoItem: { flex: 1, paddingVertical: tokens.spacing2 },
  infoDivider: { width: 1, marginVertical: tokens.spacing2 },
  infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 3 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  infoRowBorder: { height: StyleSheet.hairlineWidth },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: tokens.spacing3 },
  actionBtn: {
    flex: 1,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    padding: tokens.spacing3,
    alignItems: 'center',
    gap: 4,
  },
  actionBtnLabel: { fontSize: 14, fontWeight: '700' },
  actionBtnDesc: { fontSize: 11 },

  // Reinstate button
  reinstateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3,
  },
  reinstateBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Verify button
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing3,
  },
  verifyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Questions
  emptyCard: {
    borderRadius: tokens.radiusLg,
    padding: tokens.spacing6,
    alignItems: 'center',
    gap: tokens.spacing2,
    marginBottom: tokens.spacing3,
  },
  emptyText: { fontSize: 14 },
  questionCard: {
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginBottom: tokens.spacing2,
  },
  questionTopRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2, marginBottom: tokens.spacing2 },
  questionStatusDot: { width: 7, height: 7, borderRadius: 4 },
  questionStatus: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize', flex: 1 },
  questionDate: { fontSize: 11 },
  questionText: { fontSize: 13, lineHeight: 18 },
  rejectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: tokens.radius,
    paddingHorizontal: tokens.spacing2,
    paddingVertical: 3,
    marginTop: tokens.spacing2,
    alignSelf: 'flex-start',
  },
  rejectionText: { fontSize: 11, fontWeight: '600' },

  // Wallet
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletInfo: { flex: 1, gap: 4 },
  walletLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  walletBalance: { fontSize: 24, fontWeight: '800' },
  adjustWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
  },
  adjustWalletBtnText: { fontSize: 13, fontWeight: '700' },

  // ── Audit History ──────────────────────────────────────────────────────────
  auditSection: {
    marginTop: tokens.spacing5,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: tokens.spacing4,
  },
  auditToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing3,
    gap: 6,
  },
  auditToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  auditCountText: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  auditEmpty: {
    alignItems: 'center',
    paddingVertical: tokens.spacing5,
    gap: 8,
  },
  auditEmptyText: {
    fontSize: 12,
  },
  auditList: {
    gap: tokens.spacing2,
  },
  auditSkeleton: {
    height: 56,
    borderRadius: tokens.radiusMd,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: tokens.spacing3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    gap: tokens.spacing3,
  },
  auditAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  auditAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  auditContent: {
    flex: 1,
    gap: 4,
  },
  auditActor: {
    fontSize: 13,
    fontWeight: '600',
  },
  auditBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  auditAction: {
    fontSize: 11,
    fontWeight: '500',
  },
  auditDiff: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 3,
  },
  auditTime: {
    fontSize: 11,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  auditPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing3,
    paddingTop: tokens.spacing2,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  auditPaginationInfo: {
    fontSize: 11,
  },
  auditPageButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  auditPageBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditPageNum: {
    fontSize: 12,
    paddingHorizontal: 4,
  },
});