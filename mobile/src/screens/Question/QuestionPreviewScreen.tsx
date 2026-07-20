import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { DuplicateFoundModal } from '../../components/DuplicateFoundModal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { questionApi, storageApi } from '../../api/client';
import { cacheQuestionForDuplicateDetection } from '../../utils/onDeviceAI';
import { useTranslation } from 'react-i18next';
import { SEASONS, CROP_OPTIONS, DOMAINS } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { AGRO_CLIMATIC_ZONE_LABELS, AgroClimaticZone, deriveAgroClimaticZone } from '../../utils/agro-climatic-zones';
import { RootStackParamList } from '../../navigation/types';
import { adminApi } from '../../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const seasonOptions = SEASONS.map((s) => ({ value: s.value, label: s.label }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LocationRow({ label, value, textColor }: { label: string; value: string; textColor: string }) {
  return (
    <View style={locationRow.row}>
      <Text style={[locationRow.label, { color: textColor }]}>{label}</Text>
      <Text style={[locationRow.value, { color: textColor }]}>{value}</Text>
    </View>
  );
}

const locationRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: tokens.spacing2,
  },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: tokens.spacing2 },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface QuestionPreviewScreenProps {
  route: RouteProp<RootStackParamList, 'QuestionPreview'>;
}

export function QuestionPreviewScreen({ route }: QuestionPreviewScreenProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const { user } = useAuth();

  const preview = route.params;
  const [editWindowSec, setEditWindowSec] = useState(0);
  const [duplicateModal, setDuplicateModal] = useState<{
    visible: boolean;
    matchedQuestion: string;
    matchedAnswer: string | null;
    similarityScore: number | null;
  }>({ visible: false, matchedQuestion: '', matchedAnswer: null, similarityScore: null });

  useEffect(() => {
    adminApi.getConfig().then((res) => {
      setEditWindowSec(res.data.question_edit_window_seconds ?? 0);
    }).catch(() => {});
  }, []);

  const [selectedState] = useState(preview.state);
  const [selectedDistrict] = useState(preview.district ?? '');
  const [block] = useState(user?.block ?? preview.block ?? '');
  const [selectedAgroZone, setSelectedAgroZone] = useState<AgroClimaticZone>(
    (preview.agroClimaticZone as AgroClimaticZone) ?? AgroClimaticZone.OTHER,
  );
  const [domains, setDomains] = useState<string[]>(preview.domains ?? []);
  const [season, setSeason] = useState(preview.season || 'Kharif');
  const [cropType, setCropType] = useState(preview.cropType ?? '');
  const [questionText, setQuestionText] = useState(preview.questionText);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [locationCollapsed, setLocationCollapsed] = useState(true);

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!selectedState) errs.state = t('question.selectState');
    if (!selectedDistrict.trim()) errs.district = t('question.districtPlaceholder');
    if (!domains.length) errs.domains = t('question.selectDomain');
    if (!season) errs.season = t('question.selectSeason');
    if (!cropType) errs.cropType = t('question.enterCrop');
    if (!questionText.trim()) errs.questionText = t('question.enterQuestion');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Confirm submission ─────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!validate()) return;

    setLoading(true);
    try {
      let mediaType: 'none' | 'image' | 'audio' = 'none';
      let mediaUrls: string[] = [];

      if (preview.pendingImageUri) {
        // Upload image — only on final confirm
        const filename = `question-img-${Date.now()}.jpg`;
        const { url } = await storageApi.uploadImage(preview.pendingImageUri, filename);
        mediaType = 'image';
        mediaUrls = [url];
      } else if (preview.pendingAudioUri) {
        // Upload audio — only on final confirm (dev: in-memory/GCP, prod: GCP)
        const filename = `question-audio-${Date.now()}.m4a`;
        const { url } = await storageApi.uploadAudio(preview.pendingAudioUri, filename);
        mediaType = 'audio';
        mediaUrls = [url];
      }

      const payload = {
        // Location is locked to the user's profile — do not send editable values
        state: preview.state,
        district: preview.district ?? '',
        block: preview.block ?? null,
        domains,
        season,
        cropType,
        questionText: questionText.trim(),
        agroClimaticZone: selectedAgroZone,
        mediaType,
        mediaUrls,
      };

      const { data } = await questionApi.submit(payload);

      // ── GDB found a near-duplicate on submit — show modal and stay on preview ──
      if (data.duplicate?.isDuplicate) {
        setLoading(false);
        setDuplicateModal({
          visible: true,
          matchedQuestion: data.duplicate.matchedQuestion ?? '',
          matchedAnswer: data.duplicate.matchedAnswer ?? null,
          similarityScore: data.duplicate.similarityScore ?? null,
        });
        return;
      }

      await cacheQuestionForDuplicateDetection(data.id, questionText.trim());

      showToast(t('question.submitSuccess'), 'success');
      navigation.goBack();
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      showToast(getErrorMessage(err, t('question.submitFailed')), 'error');
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {t('question.submitQuestion')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              {t('question.askSubtitle')}
            </Text>
          </View>

          {/* Non-editable notice */}
          {editWindowSec === 0 && (
            <View style={[styles.notEditableNotice, { backgroundColor: '#FFF3CD' }]}>
              <Ionicons name="information-circle" size={18} color="#B45309" />
              <Text style={[styles.notEditableText, { color: '#B45309' }]}>
                This question is not editable after submission
              </Text>
            </View>
          )}

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: theme.colors.surface, ...tokens.shadowMd }]}>

            {/* Location (collapsible, read-only — locked to profile) */}
            <View style={[styles.locationCard, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, borderWidth: 1 }]}>
              <TouchableOpacity
                style={styles.locationHeader}
                onPress={() => setLocationCollapsed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={styles.locationHeaderLeft}>
                  <Ionicons name="location" size={16} color={theme.colors.primary} />
                  <Text style={[styles.locationHeaderText, { color: theme.colors.text }]}>
                    {t('question.location')}
                  </Text>
                </View>
                <Ionicons
                  name={locationCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {!locationCollapsed && (
                <View style={styles.locationBody}>
                  <LocationRow label={t('question.state')} value={selectedState} textColor={theme.colors.text} />
                  <LocationRow label={t('question.district')} value={selectedDistrict} textColor={theme.colors.text} />
                  {block ? <LocationRow label={t('question.blockOptional')} value={block} textColor={theme.colors.text} /> : null}
                  <View style={[styles.locationNote, { borderTopColor: theme.colors.border }]}>
                    <Ionicons name="lock-closed" size={12} color={theme.colors.textSecondary} />
                    <Text style={[styles.locationNoteText, { color: theme.colors.textSecondary }]}>
                      {t('question.locationLockedNote')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Agro-Climatic Zone (read-only) */}
            <View style={styles.zoneBadgeWrap}>
              <Text style={[styles.zoneLabel, { color: theme.colors.textSecondary }]}>
                Agro-Climatic Zone<Text style={{ color: theme.colors.error }}> *</Text>
              </Text>
              <View style={[styles.zoneBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                <Text style={[styles.zoneBadgeText, { color: theme.colors.primary }]}>
                  {AGRO_CLIMATIC_ZONE_LABELS[selectedAgroZone] ?? preview.agroClimaticZone}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Domains */}
            <View style={styles.domainSection}>
              <Text style={[styles.domainLabel, { color: theme.colors.text }]}>
                {t('question.domainSelect')}{
                  <Text style={{ color: theme.colors.error }}> *</Text>
                }
              </Text>
              <Text style={[styles.domainSublabel, { color: theme.colors.textSecondary }]}>Select one or more</Text>
              <View style={styles.domainPills}>
                {DOMAINS.map((d) => {
                  const selected = domains.includes(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.domainPill,
                        {
                          backgroundColor: selected ? theme.colors.primary + '22' : theme.colors.input,
                          borderColor: selected ? theme.colors.primary : theme.colors.borderSubtle,
                        },
                      ]}
                      onPress={() => {
                        setDomains((prev) => selected ? prev.filter((x) => x !== d) : [...prev, d]);
                        setErrors({});
                      }}
                      activeOpacity={0.7}
                    >
                      {selected && (
                        <Ionicons name="checkmark-circle" size={13} color={theme.colors.primary} style={styles.pillIcon} />
                      )}
                      <Text
                        style={[styles.domainPillText, { color: selected ? theme.colors.primary : theme.colors.text }]}
                        numberOfLines={2}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.domains && (
                <Text style={[styles.domainError, { color: theme.colors.error }]}>{errors.domains}</Text>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Season */}
            <Select
              label={t('question.season')}
              required
              placeholder={t('question.seasonPlaceholder')}
              value={season}
              options={seasonOptions}
              onChange={(v) => { setSeason(v); setErrors({}); }}
              error={errors.season}
            />

            {/* Crop */}
            <Select
              label={t('question.cropType')}
              required
              placeholder={t('question.cropTypePlaceholder')}
              value={cropType}
              options={CROP_OPTIONS}
              onChange={(v) => { setCropType(v); setErrors({}); }}
              error={errors.cropType}
              searchable
            />

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Question text */}
            <Input
              label={t('question.yourQuestion')}
              required
              placeholder={t('question.questionPlaceholder')}
              value={questionText}
              onChangeText={(t) => { setQuestionText(t); setErrors({}); }}
              error={errors.questionText}
              multiline
              numberOfLines={5}
              style={{ height: 120, textAlignVertical: 'top', paddingTop: tokens.spacing3 }}
            />

            {/* ── Image preview ─────────────────────────────────────────────── */}
            {preview.pendingImageUri ? (
              <View style={styles.mediaPreviewWrap}>
                <Text style={[styles.zoneLabel, { color: theme.colors.textSecondary }]}>
                  {t('question.attachMedia')}
                </Text>
                <Image
                  source={{ uri: preview.pendingImageUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Submission stats */}
            <View style={[styles.statsRow, { backgroundColor: theme.colors.muted }]}>
              <Ionicons name="reload-circle" size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
                {t('question.dailyRemaining', { remaining: preview.remainingToday, total: preview.dailyLimit })}
              </Text>
            </View>

            {/* Audio model disclaimer */}
            {preview.pendingAudioUri ? (
              <View style={[styles.statsRow, { backgroundColor: theme.colors.muted, marginTop: tokens.spacing2 }]}>
                <Ionicons name="mic" size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
                  {t('question.audioModelDisclaimer')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={t('question.submitQuestion')}
              onPress={handleConfirm}
              loading={loading}
            />
            <Button
              title={t('goBack')}
              variant="secondary"
              onPress={() => navigation.goBack()}
              disabled={loading}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* GDB duplicate-check modal — shown when backend found a similar question on submit */}
      <DuplicateFoundModal
        visible={duplicateModal.visible}
        matchedQuestion={duplicateModal.matchedQuestion}
        matchedAnswer={duplicateModal.matchedAnswer}
        similarityScore={duplicateModal.similarityScore}
        onDismiss={() => {
          setDuplicateModal((p) => ({ ...p, visible: false }));
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: tokens.spacing6 },
  header: { marginBottom: tokens.spacing4 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1, lineHeight: 18 },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6, marginBottom: tokens.spacing4 },
  notEditableNotice: {
    flexDirection: 'row', alignItems: 'center',
    gap: tokens.spacing2, borderRadius: tokens.radiusMd,
    padding: tokens.spacing3, marginBottom: tokens.spacing3,
  },
  notEditableText: { fontSize: 13, flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: tokens.spacing3 },
  divider: { height: 1, marginVertical: tokens.spacing4 },
  zoneBadgeWrap: { marginBottom: tokens.spacing4 },
  zoneLabel: { fontSize: 13, fontWeight: '500', marginBottom: tokens.spacing2 },
  zoneBadge: {
    alignSelf: 'flex-start', borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing2, paddingHorizontal: tokens.spacing3,
  },
  zoneBadgeText: { fontSize: 13, fontWeight: '600' },
  domainSection: { marginBottom: tokens.spacing4 },
  domainLabel: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing1 },
  domainSublabel: { fontSize: 12, marginBottom: tokens.spacing3 },
  domainPills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  domainPill: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing2, paddingHorizontal: tokens.spacing3 + 2,
    minHeight: 36,
  },
  pillIcon: { marginRight: 4 },
  domainPillText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  domainError: { fontSize: 12, marginTop: tokens.spacing2 },
  mediaPreviewWrap: { marginBottom: tokens.spacing4 },
  previewImage: { width: '100%', height: 160, borderRadius: tokens.radiusMd, marginTop: tokens.spacing2 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: tokens.spacing2, borderRadius: tokens.radiusMd, padding: tokens.spacing3,
  },
  statsText: { fontSize: 13 },
  actions: { gap: tokens.spacing3, marginBottom: tokens.spacing6 },
  locationCard: {
    borderRadius: tokens.radiusMd,
    marginBottom: tokens.spacing4,
    overflow: 'hidden',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing3,
    paddingHorizontal: tokens.spacing3,
  },
  locationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
  },
  locationHeaderText: { fontSize: 14, fontWeight: '600' },
  locationBody: {
    paddingHorizontal: tokens.spacing3,
    paddingBottom: tokens.spacing3,
  },
  locationNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing1,
    borderTopWidth: 1,
    paddingTop: tokens.spacing2,
    marginTop: tokens.spacing1,
  },
  locationNoteText: { fontSize: 12 },
});