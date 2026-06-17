import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { userApi } from '../../api/client';
import { tokens } from '../../utils/theme';
import { AppNotification, NotificationsResponse, NotificationType } from '../../types';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function notifIcon(type: NotificationType): { name: keyof typeof Ionicons.glyphMap; color: string } {
  switch (type) {
    case NotificationType.QUESTION_APPROVED:     return { name: 'checkmark-circle', color: '#22c55e' };
    case NotificationType.QUESTION_REJECTED:     return { name: 'close-circle', color: '#ef4444' };
    case NotificationType.QUESTION_HELD:         return { name: 'time', color: '#f59e0b' };
    case NotificationType.QUESTION_INFO_REQUESTED: return { name: 'information-circle', color: '#3b82f6' };
    case NotificationType.REWARD_CREDITED:       return { name: 'cash', color: '#22c55e' };
    case NotificationType.WITHDRAWAL_APPROVED:   return { name: 'wallet', color: '#22c55e' };
    case NotificationType.WITHDRAWAL_REJECTED:   return { name: 'wallet', color: '#ef4444' };
    case NotificationType.ACCOUNT_SUSPENDED:     return { name: 'alert-circle', color: '#f59e0b' };
    case NotificationType.ACCOUNT_BANNED:        return { name: 'shield-outline', color: '#ef4444' };
    default:                                     return { name: 'notifications', color: '#6366f1' };
  }
}

// ─── Item ─────────────────────────────────────────────────────────────────────

function NotificationItem({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const icon = notifIcon(item.notificationType);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.item,
        {
          backgroundColor: item.isRead ? c.surface : c.card,
          borderColor: c.border,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: icon.color + '18' }]}>
        <Ionicons name={icon.name as any} size={22} color={icon.color} />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text
            style={[styles.itemTitle, { color: c.text }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {!item.isRead && (
            <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />
          )}
        </View>
        <Text style={[styles.itemBody, { color: c.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.itemTime, { color: c.textTertiary }]}>{timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function NotificationScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.colors;
  const navigation = useNavigation<Nav>();

  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetch = useCallback(async (page = 1, append = false) => {
    try {
      const res = await userApi.getNotifications({ page, limit: 20 });
      const body = res.data as NotificationsResponse;
      setData((prev) => {
        if (!prev || page === 1) return body;
        return {
          ...body,
          notifications: [...prev.notifications, ...body.notifications],
        };
      });
    } catch (err) {
      // surface error gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetch(1); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(1); };

  const onEndReached = () => {
    if (!data || loadingMore) return;
    const totalLoaded = data.notifications.length;
    if (totalLoaded >= data.total) return;
    setLoadingMore(true);
    fetch(Math.ceil(totalLoaded / 20) + 1, true);
  };

  const handleMarkAllRead = async () => {
    try {
      await userApi.markAllNotificationsRead();
      setData((prev) => prev ? { ...prev, unread: 0, notifications: prev.notifications.map((n) => ({ ...n, isRead: true })) } : prev);
    } catch {}
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <NotificationItem
      item={item}
      onPress={async () => {
        if (item.isRead) return;
        try {
          await userApi.markNotificationRead(item.id);
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  unread: Math.max(0, prev.unread - 1),
                  notifications: prev.notifications.map((n) =>
                    n.id === item.id ? { ...n, isRead: true } : n,
                  ),
                }
              : prev,
          );
        } catch {}
      }}
    />
  );

  const ListHeader = (
    <View style={styles.headerRow}>
      <Text style={[styles.screenTitle, { color: c.text }]}>{t('notifications.title', 'Notifications')}</Text>
      {data && data.unread > 0 && (
        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
          <Text style={[styles.markAllText, { color: c.primary }]}>
            {t('notifications.markAllRead', 'Mark all read')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const ListEmpty = !loading ? (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={56} color={c.textTertiary} />
      <Text style={[styles.emptyTitle, { color: c.text }]}>
        {t('notifications.emptyTitle', 'No notifications yet')}
      </Text>
      <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
        {t('notifications.emptySubtitle', "You're all caught up!")}
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.topBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]} numberOfLines={1}>
          {t('notifications.title', 'Notifications')}
        </Text>
        <View style={styles.topBarRight} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={data?.notifications ?? []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ItemSeparatorComponent={() => <View style={{ height: tokens.spacing2 }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing2, paddingVertical: tokens.spacing2,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  topBarRight: { width: 40 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: tokens.spacing4, flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing4 },
  screenTitle: { fontSize: 22, fontWeight: '800' },
  markAllBtn: { paddingHorizontal: tokens.spacing2, paddingVertical: tokens.spacing1 },
  markAllText: { fontSize: 14, fontWeight: '600' },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing3,
    borderWidth: 1, borderRadius: tokens.radiusLg, padding: tokens.spacing4,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemContent: { flex: 1, gap: 3 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing2 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  itemBody: { fontSize: 13, lineHeight: 18 },
  itemTime: { fontSize: 12, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: tokens.spacing3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: tokens.spacing2 },
  emptySubtitle: { fontSize: 14 },
});