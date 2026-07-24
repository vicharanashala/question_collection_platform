import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/Toast';
import { faqApi, getErrorMessage } from '../../api/client';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Faq } from '../../types';
import { tokens } from '../../utils/theme';
import i18n from '../../i18n';

const $t = (k: string) => i18n.t(k);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  visible: boolean;
  faq: Faq | null;
  onClose: () => void;
  onSave: (data: { question: string; answer: string; isVisible: boolean }) => Promise<void>;
}

function EditModal({ visible, faq, onClose, onSave }: EditModalProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({ question: '', answer: '' });

  useEffect(() => {
    if (visible) {
      setQuestion(faq?.question ?? '');
      setAnswer(faq?.answer ?? '');
      setIsVisible(faq?.isVisible ?? true);
      setErrors({ question: '', answer: '' });
    }
  }, [visible, faq]);

  function validate() {
    const e = { question: '', answer: '' };
    if (!question.trim()) e.question = '1';
    if (!answer.trim()) e.answer = '1';
    setErrors(e);
    return !e.question && !e.answer;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ question: question.trim(), answer: answer.trim(), isVisible });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalSheet, { backgroundColor: c.surface }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: c.borderSubtle }]}>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={22} color={c.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {faq ? $t('faqAdmin.editTitle') : $t('faqAdmin.addTitle')}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={c.primary} />
                : <Text style={[styles.saveBtn, { color: c.primary }]}>{$t('faqAdmin.save')}</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Question */}
            <Text style={[styles.label, { color: c.textSecondary }]}>{$t('faqAdmin.formQuestion')}</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: c.background, color: c.text, borderColor: errors.question ? c.error : c.border },
              ]}
              placeholder={$t('faqAdmin.formQuestionPlaceholder')}
              placeholderTextColor={c.textTertiary}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
            {errors.question ? <Text style={[styles.fieldError, { color: c.error }]}>{$t('faqAdmin.validationQuestion')}</Text> : null}

            {/* Answer */}
            <Text style={[styles.label, { color: c.textSecondary, marginTop: tokens.spacing4 }]}>{$t('faqAdmin.formAnswer')}</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: c.background, color: c.text, borderColor: errors.answer ? c.error : c.border },
              ]}
              placeholder={$t('faqAdmin.formAnswerPlaceholder')}
              placeholderTextColor={c.textTertiary}
              value={answer}
              onChangeText={setAnswer}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            {errors.answer ? <Text style={[styles.fieldError, { color: c.error }]}>{$t('faqAdmin.validationAnswer')}</Text> : null}

            {/* Visibility toggle */}
            <View style={[styles.toggleRow, { borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleLabel, { color: c.text }]}>{$t('faqAdmin.formVisibleLabel')}</Text>
                <Text style={[styles.toggleDesc, { color: c.textSecondary }]}>
                  {$t('faqAdmin.formVisibleDesc')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, { backgroundColor: isVisible ? c.primary : c.border }]}
                onPress={() => setIsVisible((v) => !v)}
              >
                <View style={[styles.toggleThumb, { backgroundColor: '#fff' }]} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function AdminFaqsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { showToast } = useToast();

  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<Faq | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await faqApi.getAll();
      setItems(res.data);
    } catch (e) {
      showToast(getErrorMessage(e, $t('common.failedToLoad')), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch_();
  }

  async function handleSave(data: { question: string; answer: string; isVisible: boolean }) {
    if (editTarget) {
      const res = await faqApi.update(editTarget.id, data);
      setItems((prev) => prev.map((i) => (i.id === editTarget.id ? res.data : i)));
      showToast($t('faqAdmin.success.updated'), 'success');
    } else {
      const res = await faqApi.create(data);
      setItems((prev) => [...prev, res.data]);
      showToast($t('faqAdmin.success.created'), 'success');
    }
  }

  async function handleToggle(faq: Faq) {
    const next = !faq.isVisible;
    setToggling(faq.id);
    // Optimistic update
    setItems((prev) => prev.map((i) => (i.id === faq.id ? { ...i, isVisible: next } : i)));
    try {
      const res = await faqApi.toggleVisibility(faq.id, next);
      setItems((prev) => prev.map((i) => (i.id === faq.id ? res.data : i)));
      showToast(next ? $t('faqAdmin.success.visible') : $t('faqAdmin.success.hidden'), 'success');
    } catch (e) {
      // Revert
      setItems((prev) => prev.map((i) => (i.id === faq.id ? faq : i)));
      showToast(getErrorMessage(e, $t('common.failedToUpdate')), 'error');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await faqApi.remove(deleteTarget.id);
      setItems((prev) => prev.filter((i) => (i.id !== deleteTarget.id)));
      showToast($t('faqAdmin.success.deleted'), 'success');
    } catch (e) {
      showToast(getErrorMessage(e, $t('common.failedToDelete')), 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  const renderItem = ({ item }: { item: Faq }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderSubtle }]}
      activeOpacity={0.7}
      onPress={() => setEditTarget(item)}
    >
      <View style={styles.cardBody}>
        <Text style={[styles.question, { color: c.text }]} numberOfLines={2}>
          {item.question}
        </Text>
        <Text style={[styles.answer, { color: c.textSecondary }]} numberOfLines={2}>
          {item.answer}
        </Text>
        <Text style={[styles.meta, { color: c.textTertiary }]}>
          {$t('faqAdmin.updated')} {fmt(item.updatedAt)}
        </Text>
      </View>

      <View style={styles.cardActions}>
        {/* Visibility badge */}
        <View
          style={[
            styles.badge,
            { backgroundColor: item.isVisible ? '#d1fae5' : '#f3f4f6' },
          ]}
        >
          <Ionicons
            name={item.isVisible ? 'eye' : 'eye-off'}
            size={11}
            color={item.isVisible ? '#059669' : '#9ca3af'}
          />
          <Text
            style={[
              styles.badgeText,
              { color: item.isVisible ? '#059669' : '#9ca3af' },
            ]}
          >
            {item.isVisible ? $t('faqAdmin.visible') : $t('faqAdmin.hidden')}
          </Text>
        </View>

        {/* Toggle */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => handleToggle(item)}
          disabled={toggling === item.id}
        >
          {toggling === item.id ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <Ionicons
              name={item.isVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={item.isVisible ? c.textTertiary : c.primary}
            />
          )}
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setDeleteTarget(item)}
        >
          <Ionicons name="trash-outline" size={20} color={c.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => setAddOpen(true)} style={[styles.addBtn, { backgroundColor: c.primary }]}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>{$t('faqAdmin.addBtn')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={c.primary} /></View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="help-circle-outline" size={64} color={c.textTertiary} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>{$t('faqAdmin.emptyTitle')}</Text>
          <Text style={[styles.emptySub, { color: c.textSecondary }]}>
            {$t('faqAdmin.emptySubtitle')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.primary]} />
          }
          ItemSeparatorComponent={() => <View style={{ height: tokens.spacing3 }} />}
        />
      )}

      {/* Edit modal */}
      <EditModal
        visible={!!editTarget}
        faq={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSave}
      />

      {/* Add modal */}
      <EditModal
        visible={addOpen}
        faq={null}
        onClose={() => setAddOpen(false)}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        visible={!!deleteTarget}
        title={$t('faqAdmin.deleteTitle')}
        message={$t('faqAdmin.deleteConfirm')}
        confirmLabel={$t('common.delete')}
        variant="danger"
        loading={false}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: tokens.spacing2 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: tokens.spacing4 },
  emptySub: { fontSize: 14, marginTop: tokens.spacing1 },

  header: {
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing2,
    paddingVertical: tokens.spacing3,
    borderRadius: tokens.radiusMd,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  list: { padding: tokens.spacing4 },

  card: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    padding: tokens.spacing4,
    flexDirection: 'row',
    gap: tokens.spacing3,
  },
  cardBody: { flex: 1 },
  question: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  answer: { fontSize: 13, lineHeight: 18, marginTop: tokens.spacing2 },
  meta: { fontSize: 11, marginTop: tokens.spacing2 },

  cardActions: { alignItems: 'flex-end', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: tokens.spacing5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  saveBtn: { fontSize: 15, fontWeight: '600' },
  modalBody: { padding: tokens.spacing4, gap: tokens.spacing2 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: tokens.spacing1, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: {
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing3,
    fontSize: 15,
    minHeight: 48,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing3,
    paddingVertical: tokens.spacing3,
    fontSize: 15,
    minHeight: 120,
  },
  fieldError: { fontSize: 12, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
    marginTop: tokens.spacing4,
    gap: tokens.spacing3,
  },
  toggleLabel: { fontSize: 15, fontWeight: '500' },
  toggleDesc: { fontSize: 12, marginTop: 2 },
  toggleSwitch: {
    width: 46,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignSelf: 'flex-end',
  },
});