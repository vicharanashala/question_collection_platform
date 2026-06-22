import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toast';
import { adminApi, getErrorMessage } from '../../api/client';
import { tokens } from '../../utils/theme';

interface ConfigItem {
  key: string;
  value: number;
  description: string;
}

const CONFIG_META: Record<string, { label: string; suffix: string }> = {
  max_users_per_state: { label: 'Max Users / State', suffix: '' },
  min_withdrawal_amount: { label: 'Min Withdrawal', suffix: '₹' },
  question_edit_window_seconds: { label: 'Edit Window', suffix: 's' },
  daily_question_limit: { label: 'Daily Question Limit', suffix: '/day' },
  ai_confidence_threshold: { label: 'AI Confidence Threshold', suffix: '%' },
  duplicate_similarity_threshold: { label: 'Duplicate Similarity', suffix: '' },
}

// Config keys hidden from the UI (video features disabled)
const HIDDEN_CONFIG_KEYS = new Set(['video_max_duration_seconds', 'video_max_size_mb'])

export function AdminConfigScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useNavigation();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await adminApi.getConfig();
      setConfigs(res.data.items ?? []);
    } catch (e) {
      showToast(getErrorMessage(e, 'Failed to load config'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch();
  }

  async function handleUpdate(key: string, currentValue: number) {
    Alert.prompt(
      'Update Config',
      `Enter new value for ${CONFIG_META[key]?.label ?? key}:`,
      async (raw) => {
        const val = parseFloat(raw ?? '');
        if (isNaN(val) || val < 0) {
          showToast('Invalid value', 'warning');
          return;
        }
        setSaving(key);
        try {
          await adminApi.updateConfig({ key, value: val });
          setConfigs((prev) =>
            prev.map((c) => (c.key === key ? { ...c, value: val } : c)),
          );
          showToast('Config updated', 'success');
        } catch (e) {
          showToast(getErrorMessage(e, 'Update failed'), 'error');
        } finally {
          setSaving(null);
        }
      },
      'plain-text',
      String(currentValue),
      'numeric',
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: c.text, flex: 1 }]}>Configuration</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
          Tap a config to edit. Changes apply immediately and are audit-logged.
        </Text>

        {configs
          .filter((cfg) => !HIDDEN_CONFIG_KEYS.has(cfg.key))
          .map((cfg) => {
            const meta = CONFIG_META[cfg.key];
            return (
              <TouchableOpacity
                key={cfg.key}
                style={[styles.row, { backgroundColor: c.surface }]}
                onPress={isSuperAdmin ? () => handleUpdate(cfg.key, cfg.value) : undefined}
                disabled={saving !== null || !isSuperAdmin}
                activeOpacity={isSuperAdmin ? 0.7 : 1}
              >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: c.text }]}>
                  {meta?.label ?? cfg.key}
                </Text>
                {cfg.description && (
                  <Text style={[styles.rowDesc, { color: c.textTertiary }]}>
                    {cfg.description}
                  </Text>
                )}
              </View>
              <View style={styles.rowRight}>
                {saving === cfg.key ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : (
                  <Text style={[styles.rowValue, { color: c.primary }]}>
                    {meta?.suffix === '₹' ? '₹' : ''}{cfg.value}{meta?.suffix ?? ''}
                  </Text>
                )}
                <Text style={[styles.editHint, { color: c.textTertiary }]}>
                  {isSuperAdmin ? 'Tap to edit' : 'Super admin only'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
  subtitle: { fontSize: 13, marginBottom: tokens.spacing5 },
  row: {
    borderRadius: tokens.radiusMd, padding: tokens.spacing4,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: tokens.spacing2,
  },
  rowLeft: { flex: 1, marginRight: tokens.spacing3 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowDesc: { fontSize: 11, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowValue: { fontSize: 16, fontWeight: '700' },
  editHint: { fontSize: 10, marginTop: 2 },
});