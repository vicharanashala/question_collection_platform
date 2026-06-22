import React, { useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { userApi } from '../../api/client';
import { ConfirmModal } from '../../components/ConfirmModal';
import { SEASONS, CROP_OPTIONS } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import type { CropDetail } from '../../types';

const EMPTY_CROP = { cropName: '', season: '' };

const seasonOptions = SEASONS.map((s) => ({ value: s.value, label: s.label }));

export function CropManagementScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [crops, setCrops] = useState<CropDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ cropName: string; season: string }>(EMPTY_CROP);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CropDetail | null>(null);

  const fetchCrops = useCallback(async () => {
    try {
      const res = await userApi.getProfile();
      setCrops(res.data.data?.crops ?? []);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { fetchCrops(); }, [fetchCrops]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_CROP);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(crop: CropDetail) {
    setEditingId(crop.id);
    setForm({ cropName: crop.cropName, season: (crop.season as string) ?? '' });
    setFormError(null);
    setModalOpen(true);
  }

  function validate(): boolean {
    if (!form.cropName) {
      setFormError(t('crops.cropNamePlaceholder'));
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const updated = editingId
        ? crops.map((cr) => cr.id === editingId ? { ...cr, cropName: form.cropName, season: form.season || null } : cr)
        : [...crops, { id: `new-${Date.now()}`, cropName: form.cropName, season: form.season || null }];

      await userApi.updateCrops(updated.map((c) => ({ cropName: c.cropName, season: c.season || undefined })));
      setCrops(updated);
      setModalOpen(false);
      showToast(t('crops.saveSuccess'), 'success');
    } catch {
      showToast(t('common.serverError'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(crop: CropDetail) {
    setDeleteTarget(crop);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const updated = crops.filter((c) => c.id !== deleteTarget.id);
      await userApi.updateCrops(updated.map((c) => ({ cropName: c.cropName, season: c.season || undefined })));
      setCrops(updated);
      showToast(t('crops.deleteSuccess'), 'success');
    } catch {
      showToast(t('common.serverError'), 'error');
    } finally {
      setDeleteTarget(null);
    }
  }

  function seasonLabel(raw: string | null) {
    if (!raw) return null;
    return seasonOptions.find((o) => o.value === raw)?.label ?? raw;
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.borderSubtle }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{t('crops.title')}</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addHeaderBtn}>
          <Ionicons name="add-circle" size={26} color={c.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={c.primary} />
          </View>
        ) : crops.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="leaf-outline" size={52} color={c.textTertiary} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>{t('crops.noCrops')}</Text>
            <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>{t('crops.noCropsDesc')}</Text>
            <Button title={t('crops.addFirst')} onPress={openAdd} style={styles.emptyBtn} />
          </View>
        ) : (
          <View style={styles.list}>
            {crops.map((crop) => (
              <View key={crop.id} style={[styles.cropCard, { backgroundColor: c.surface, ...tokens.shadowSm }]}>
                <View style={styles.cropLeft}>
                  <View style={[styles.cropIconWrap, { backgroundColor: c.primary + '18' }]}>
                    <Ionicons name="leaf-outline" size={16} color={c.primary} />
                  </View>
                  <View style={styles.cropInfo}>
                    <Text style={[styles.cropName, { color: c.text }]}>{crop.cropName}</Text>
                    {crop.season && (
                      <Text style={[styles.cropSeason, { color: c.textSecondary }]}>
                        {seasonLabel(crop.season)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.cropActions}>
                  <TouchableOpacity onPress={() => openEdit(crop)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="pencil" size={18} color={c.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(crop)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={c.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Button
              title={t('crops.addCrop')}
              variant="ghost"
              onPress={openAdd}
              style={styles.addBtn}
            />
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: c.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: c.borderSubtle }]}>
              <Text style={[styles.modalTitle, { color: c.text }]}>
                {editingId ? t('crops.editCrop') : t('crops.addCrop')}
              </Text>
              <TouchableOpacity onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Select
                label={t('crops.cropName')}
                placeholder={t('crops.cropNamePlaceholder')}
                value={form.cropName}
                options={CROP_OPTIONS}
                onChange={(v) => { setForm((f) => ({ ...f, cropName: v })); setFormError(null); }}
                error={formError ?? undefined}
                searchable
              />
              <Select
                label={t('crops.season')}
                placeholder={t('crops.selectSeason')}
                value={form.season}
                options={seasonOptions}
                onChange={(season) => setForm((f) => ({ ...f, season }))}
              />
              <Button
                title={t('common.save')}
                onPress={handleSave}
                loading={saving}
                style={styles.modalSaveBtn}
              />
              <Button
                title={t('common.cancel')}
                variant="ghost"
                onPress={() => setModalOpen(false)}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
        <ConfirmModal
          visible={deleteTarget !== null}
          title={t('crops.deleteConfirm')}
          message={`${deleteTarget?.cropName ?? ''}`}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          variant="danger"
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing4,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: tokens.spacing3 },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  addHeaderBtn: { marginLeft: tokens.spacing2 },
  scroll: { flexGrow: 1, paddingBottom: tokens.spacing8 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: tokens.spacing8 * 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing8, paddingTop: tokens.spacing8 * 3 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: tokens.spacing4 },
  emptyDesc: { fontSize: 14, textAlign: 'center', marginTop: tokens.spacing2, marginBottom: tokens.spacing5 },
  emptyBtn: { paddingHorizontal: tokens.spacing6 },
  list: { padding: tokens.spacing4 },
  cropCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing4,
    marginBottom: tokens.spacing3,
  },
  cropLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: tokens.spacing3 },
  cropIconWrap: { width: 40, height: 40, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center' },
  cropIcon: { fontSize: 18 },
  cropInfo: {},
  cropName: { fontSize: 15, fontWeight: '600' },
  cropSeason: { fontSize: 12, marginTop: 2 },
  cropActions: { flexDirection: 'row', gap: tokens.spacing3 },
  deleteBtn: { marginLeft: tokens.spacing2 },
  addBtn: { marginTop: tokens.spacing2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: tokens.radiusXl, borderTopRightRadius: tokens.radiusXl, maxHeight: '75%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing6,
    paddingVertical: tokens.spacing4,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalBody: { padding: tokens.spacing6, paddingBottom: tokens.spacing8 },
  modalSaveBtn: { marginTop: tokens.spacing2, marginBottom: tokens.spacing2 },
});