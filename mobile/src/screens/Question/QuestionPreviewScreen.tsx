import React, { useState, useEffect } from 'react';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Image,  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../hooks/useTheme';
import { questionApi, lgdApi } from '../../api/client';
import { cacheQuestionForDuplicateDetection } from '../../utils/onDeviceAI';
import { useTranslation } from 'react-i18next';
import { SEASONS, CROP_OPTIONS, DOMAINS } from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { AGRO_CLIMATIC_ZONE_LABELS, AgroClimaticZone } from '../../utils/agro-climatic-zones';
import { RootStackParamList } from '../../navigation/types';
import { adminApi } from '../../api/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const seasonOptions = SEASONS.map((s) => ({ value: s.value, label: s.label }));
// ─── Component ────────────────────────────────────────────────────────────────

interface QuestionPreviewScreenProps {
  route: RouteProp<RootStackParamList, 'QuestionPreview'>;
}

export function QuestionPreviewScreen({ route }: QuestionPreviewScreenProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const navigation = useNavigation();

  const preview = route.params;
  const [editWindowSec, setEditWindowSec] = useState(0);

  useEffect(() => {
    adminApi.getConfig().then((res) => {
      setEditWindowSec(res.data.question_edit_window_seconds ?? 0);
    }).catch(() => {});
  }, []);

  // Editable form state — domains pre-filled from backend inference
  const [selectedState, setSelectedState] = useState(preview.state);
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState(preview.district);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [block, setBlock] = useState(preview.block ?? '');
  const [domains, setDomains] = useState<string[]>(preview.domains ?? []);
  const [season, setSeason] = useState(preview.season || 'Kharif');
  const [cropType, setCropType] = useState(preview.cropType ?? '');
  const [questionText, setQuestionText] = useState(preview.questionText);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // LGD reference data
  const [stateList, setStateList] = useState<{ code: string; name: string }[]>([]);
  const [districtList, setDistrictList] = useState<{ code: string; name: string }[]>([]);
  const [blockList, setBlockList] = useState<{ code: string; name: string }[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Load states; pre-fill districts/blocks from the backend's pre-filled state/district
  useEffect(() => {
    setLoadingStates(true);
    lgdApi.getStates()
      .then((res) => {
        setStateList(res.data.states);
        if (preview.state) {
          const match = res.data.states.find((s) => s.name === preview.state);
          if (match) {
            setSelectedStateCode(match.code);
            return lgdApi.getDistricts(match.code);
          }
        }
        return null;
      })
      .then((res) => {
        if (!res) return;
        setDistrictList(res.data.districts);
        if (preview.district) {
          const dm = res.data.districts.find((d: any) => d.name === preview.district);
          if (dm) {
            setSelectedDistrictCode(dm.code);
            return lgdApi.getSubDistricts(dm.code);
          }
        }
        return null;
      })
      .then((res) => {
        if (!res) return;
        setBlockList(res.data.subdistricts);
      })
      .catch(() => {})
      .finally(() => setLoadingStates(false));
  }, []);

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
      const payload = {
        state: selectedState,
        district: selectedDistrict.trim(),
        block: block.trim() || null,
        domains,
        season,
        cropType,
        questionText: questionText.trim(),
        agroClimaticZone: preview.agroClimaticZone,
        mediaType: preview.mediaType,
        mediaUrls: preview.mediaUrls ?? [],
      };

      const { data } = await questionApi.submit(payload);

      // Populate local duplicate cache with the new question so future submissions
      // can be checked against it without a server round-trip.
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

          {/* Edit card */}
          <View style={[styles.card, { backgroundColor: theme.colors.surface, ...tokens.shadowMd }]}>

            {/* State */}
            <Select
              label={t('question.state')}
              value={selectedState}
              options={stateList.map((s) => ({ value: s.name, label: s.name }))}
              onChange={async (v) => {
                setSelectedState(v);
                setSelectedStateCode(stateList.find((s) => s.name === v)?.code ?? '');
                setSelectedDistrict('');
                setSelectedDistrictCode('');
                setBlockList([]);
                setBlock('');
                setErrors({});
                setLoadingDistricts(true);
                try {
                  const code = stateList.find((s) => s.name === v)?.code ?? '';
                  const res = await lgdApi.getDistricts(code);
                  setDistrictList(res.data.districts);
                } catch { setDistrictList([]); }
                finally { setLoadingDistricts(false); }
              }}
              error={errors.state}
              searchable
              loading={loadingStates}
            />

            <Select
              label={t('question.district')}
              placeholder={t('selectDistrict')}
              value={selectedDistrict}
              options={districtList.map((d) => ({ value: d.name, label: d.name }))}
              onChange={async (v) => {
                setSelectedDistrict(v);
                setSelectedDistrictCode(districtList.find((d) => d.name === v)?.code ?? '');
                setBlockList([]);
                setBlock('');
                setErrors({});
                const code = districtList.find((d) => d.name === v)?.code ?? '';
                if (!code) return;
                setLoadingBlocks(true);
                try {
                  const res = await lgdApi.getSubDistricts(code);
                  setBlockList(res.data.subdistricts);
                } catch { setBlockList([]); }
                finally { setLoadingBlocks(false); }
              }}
              error={errors.district}
              searchable
              loading={loadingDistricts}
            />

            <Select
              label={t('question.blockOptional')}
              placeholder={t('selectBlock')}
              value={block}
              options={blockList.map((b) => ({ value: b.name, label: b.name }))}
              onChange={setBlock}
              searchable
              loading={loadingBlocks}
            />

            {/* Agro-Climatic Zone (read-only) */}
            <View style={styles.zoneBadgeWrap}>
              <Text style={[styles.zoneLabel, { color: theme.colors.textSecondary }]}>
                {'Agro-Climatic Zone'}
              </Text>
              <View style={[styles.zoneBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                <Text style={[styles.zoneBadgeText, { color: theme.colors.primary }]}>
                  {AGRO_CLIMATIC_ZONE_LABELS[preview.agroClimaticZone as AgroClimaticZone] ?? preview.agroClimaticZone}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Domains — all listed, backend-returned ones pre-selected */}
            <View style={styles.domainSection}>
              <Text style={[styles.domainLabel, { color: theme.colors.text }]}>
                {t('question.domain') ?? 'Agriculture Domain'}
              </Text>
              <Text style={[styles.domainSublabel, { color: theme.colors.textSecondary }]}>
                Select one or more
              </Text>
              <View style={styles.domainPills}>
                {DOMAINS.map((d) => {
                  const selected = domains.includes(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.domainPill,
                        {
                          backgroundColor: selected
                            ? theme.colors.primary + '22'
                            : theme.colors.input,
                          borderColor: selected
                            ? theme.colors.primary
                            : theme.colors.borderSubtle,
                        },
                      ]}
                      onPress={() => {
                        setDomains((prev) =>
                          selected ? prev.filter((x) => x !== d) : [...prev, d],
                        );
                        setErrors({});
                      }}
                      activeOpacity={0.7}
                    >
                      {selected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={13}
                          color={theme.colors.primary}
                          style={styles.pillIcon}
                        />
                      )}
                      <Text
                        style={[
                          styles.domainPillText,
                          { color: selected ? theme.colors.primary : theme.colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.domains && (
                <Text style={[styles.domainError, { color: theme.colors.error }]}>
                  {errors.domains}
                </Text>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Season */}
            <Select
              label={t('question.season')}
              placeholder={t('question.seasonPlaceholder')}
              value={season}
              options={seasonOptions}
              onChange={(v) => { setSeason(v); setErrors({}); }}
              error={errors.season}
            />

            {/* Crop */}
            <Select
              label={t('question.cropType')}
              placeholder={t('question.cropTypePlaceholder')}
              value={cropType}
              options={CROP_OPTIONS}
              onChange={(v) => { setCropType(v); setErrors({}); }}
              error={errors.cropType}
              searchable
            />

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Question text */}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('question.yourQuestion') ?? 'Your Question'}
            </Text>

            <Input
              placeholder={t('question.questionPlaceholder') ?? 'Type your agriculture question here…'}
              value={questionText}
              onChangeText={(t) => { setQuestionText(t); setErrors({}); }}
              error={errors.questionText}
              multiline
              numberOfLines={5}
              style={{ height: 120, textAlignVertical: 'top', paddingTop: tokens.spacing3 }}
            />

            {/* Media preview */}
            {preview.mediaUrls && preview.mediaUrls.length > 0 && (
              <View style={styles.mediaPreviewWrap}>
                <Text style={[styles.zoneLabel, { color: theme.colors.textSecondary }]}>
                  {t('question.attachMedia')}
                </Text>
                <Image
                  source={{ uri: preview.mediaUrls[0] }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Audio indicator */}
            {preview.mediaType === 'audio' && (
              <View style={[styles.audioIndicator, { backgroundColor: theme.colors.muted }]}>
                <Ionicons name="mic" size={24} color={theme.colors.text} />
                <Text style={[styles.audioIndicatorText, { color: theme.colors.text }]}>
                  {t('question.attachMedia')}
                </Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: theme.colors.borderSubtle }]} />

            {/* Submission stats */}
            <View style={[styles.statsRow, { backgroundColor: theme.colors.muted }]}>
              <Ionicons name="reload-circle" size={18} color={theme.colors.textSecondary} />
              <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
                {preview.remainingToday} of {preview.dailyLimit} submissions remaining today
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={t('question.submitQuestion') ?? 'Submit'}
              onPress={handleConfirm}
              loading={loading}
            />
            <Button
              title={'Go Back'}
              variant="secondary"
              onPress={() => navigation.goBack()}
              disabled={loading}
            />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginBottom: tokens.spacing3,
  },
  notEditableText: { fontSize: 13, flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: tokens.spacing3 },
  divider: { height: 1, marginVertical: tokens.spacing4 },
  zoneBadgeWrap: { marginBottom: tokens.spacing4 },
  zoneLabel: { fontSize: 13, fontWeight: '500', marginBottom: tokens.spacing2 },
  zoneBadge: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing2,
    paddingHorizontal: tokens.spacing3,
  },
  zoneBadgeText: { fontSize: 13, fontWeight: '600' },
  domainSection: { marginBottom: tokens.spacing4 },
  domainLabel: { fontSize: 13, fontWeight: '600', marginBottom: tokens.spacing1 },
  domainSublabel: { fontSize: 12, marginBottom: tokens.spacing3 },
  domainPills: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing2 },
  domainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    paddingVertical: tokens.spacing2,
    paddingHorizontal: tokens.spacing3 + 2,
    minHeight: 36,
  },
  pillIcon: { marginRight: 4 },
  domainPillText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  domainError: { fontSize: 12, marginTop: tokens.spacing2 },
  mediaPreviewWrap: { marginBottom: tokens.spacing4 },
  previewImage: { width: '100%', height: 160, borderRadius: tokens.radiusMd, marginTop: tokens.spacing2 },
  audioIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginBottom: tokens.spacing4,
  },
  audioIndicatorText: { fontSize: 13, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
  },
  statsText: { fontSize: 13 },
  actions: { gap: tokens.spacing3, marginBottom: tokens.spacing6 },
});