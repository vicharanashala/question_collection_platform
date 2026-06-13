import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { questionApi } from '../../api/client';
import {
  SEASONS,
  DOMAIN_CATEGORIES,
  DAILY_QUESTION_LIMIT,
  EDIT_WINDOW_SEC,
  INDIAN_STATES,
} from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { compressImage, compressVideo, uploadToStorage, validateVideo } from '../../utils/media';
import { deriveAgroClimaticZone, AGRO_CLIMATIC_ZONE_LABELS, AgroClimaticZone } from '../../utils/agro-climatic-zones';
import { MainTabParamList } from '../../navigation/types';

// ─── Media picker ─────────────────────────────────────────────────────────────

type MediaMode = 'none' | 'image' | 'video' | 'audio';

interface PickerResult {
  cancelled: boolean;
  uri?: string;
  fileSize?: number;
}

async function pickImage(): Promise<PickerResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-image-picker');
    const result = await mod.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
    return { cancelled: result.cancelled, uri: result.uri, fileSize: result.fileSize };
  } catch {
    return { cancelled: true };
  }
}

async function pickVideo(): Promise<PickerResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-image-picker');
    const result = await mod.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.6, allowsEditing: false });
    return { cancelled: result.cancelled, uri: result.uri, fileSize: result.fileSize };
  } catch {
    return { cancelled: true };
  }
}

// ─── Options ──────────────────────────────────────────────────────────────────

const seasonOptions    = SEASONS.map((s)        => ({ value: s.value, label: s.label }));
const domainOptions    = DOMAIN_CATEGORIES.map((d) => ({ value: d.value, label: d.label }));
const stateOptions     = INDIAN_STATES.map((s)  => ({ value: s, label: s }));

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<MainTabParamList, 'Question'>;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function QuestionScreen({ navigation }: Props) {
  const { theme }    = useTheme();
  const c            = theme.colors;
  const { user }     = useAuth();

  // ── Form fields ──────────────────────────────────────────────────────────────
  const [domainCategory, setDomainCategory] = useState('');
  const [season,       setSeason]           = useState('');
  const [cropType,     setCropType]         = useState('');
  const [questionText, setQuestionText]     = useState('');
  const [state,        setState]            = useState(user?.state        ?? '');
  const [district,     setDistrict]         = useState(user?.district     ?? '');
  const [block,        setBlock]            = useState(user?.block        ?? '');

  // ── Media ────────────────────────────────────────────────────────────────────
  const [mediaMode,     setMediaMode]     = useState<MediaMode>('none');
  const [mediaUri,      setMediaUri]      = useState<string | null>(null);
  const [mediaPreview,  setMediaPreview]  = useState<string | null>(null);
  const [uploadingMedia,setUploadingMedia] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [submitted,    setSubmitted]    = useState(false);
  const [dailyCount,   setDailyCount]   = useState(0);
  const [remainingToday,setRemaining]   = useState(DAILY_QUESTION_LIMIT);

  // ── Auto-derived ─────────────────────────────────────────────────────────────
  // agroClimaticZone is always derived from `state` — never shown as a separate field
  const agroClimaticZone = state ? deriveAgroClimaticZone(state) : AgroClimaticZone.OTHER;

  // Load stats on mount
  useEffect(() => {
    questionApi.getStats()
      .then((res) => {
        const data = res.data as { dailyCount: number; remainingToday: number };
        setDailyCount(data.dailyCount);
        setRemaining(data.remainingToday);
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  // ── Sync state/district/block from profile when profile refreshes ─────────────
  useEffect(() => {
    if (user) {
      if (user.state    && !state)    setState(user.state);
      if (user.district && !district) setDistrict(user.district);
      if (user.block    && !block)    setBlock(user.block);
    }
  }, [user?.state, user?.district, user?.block]);

  // ── Prompt to complete profile ───────────────────────────────────────────────

  const missingProfileFields = !state || !district;

  // ── Validation ───────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (missingProfileFields) errs.state = 'Complete your profile first (state + district required)';
    if (!domainCategory) errs.domainCategory = 'Select a domain category';
    if (!season)         errs.season         = 'Select a season';
    if (!cropType.trim())errs.cropType       = 'Enter the crop type';
    if (!questionText.trim() && mediaMode === 'none') {
      errs.questionText = 'Enter your question or attach media';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Media handlers ───────────────────────────────────────────────────────────

  async function handleAttachImage() {
    setMediaMode('image');
    const result = await pickImage();
    if (result.cancelled || !result.uri) { setMediaMode('none'); return; }
    const compressed = await compressImage(result.uri);
    setMediaUri(compressed);
    setMediaPreview(result.uri);
    setErrors({});
  }

  async function handleAttachVideo() {
    setMediaMode('video');
    const result = await pickVideo();
    if (result.cancelled || !result.uri) { setMediaMode('none'); return; }
    const validation = validateVideo(result.fileSize ?? 0);
    if (!validation.valid) {
      Alert.alert('Video Too Large', validation.error);
      setMediaMode('none');
      return;
    }
    const compressed = await compressVideo(result.uri);
    setMediaUri(compressed);
    setMediaPreview(result.uri);
  }

  function handleRemoveMedia() {
    setMediaMode('none');
    setMediaUri(null);
    setMediaPreview(null);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validate()) return;

    if (remainingToday <= 0) {
      Alert.alert('Daily Limit Reached', `You have reached your limit of ${DAILY_QUESTION_LIMIT} questions today. Please try again tomorrow.`);
      return;
    }

    if (missingProfileFields) {
      Alert.alert(
        'Complete Your Profile',
        'Please add your state and district in your profile before submitting a question.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Profile', onPress: () => navigation.navigate('Profile') },
        ],
      );
      return;
    }

    setLoading(true);
    try {
      let mediaUrls: string[] | undefined;

      if (mediaUri && user?.id) {
        setUploadingMedia(true);
        try {
          mediaUrls = [await uploadToStorage(mediaUri, mediaMode as 'image' | 'video' | 'audio', user.id)];
        } finally {
          setUploadingMedia(false);
        }
      }

      await questionApi.submit({
        domainCategory,
        season,
        cropType: cropType.trim(),
        questionText: questionText.trim(),
        state,
        district,
        block: block.trim() || undefined,
        agroClimaticZone,
        submittedAt: new Date().toISOString(),
        mediaType: mediaMode,
        mediaUrls,
        deviceInfo: { platform: Platform.OS, version: Platform.Version },
      });

      setSubmitted(true);

      const stats = (await questionApi.getStats()).data as { dailyCount: number; remainingToday: number };
      setDailyCount(stats.dailyCount);
      setRemaining(stats.remainingToday);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to submit question. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
      setUploadingMedia(false);
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function reset() {
    setDomainCategory('');
    setSeason('');
    setCropType('');
    setQuestionText('');
    setMediaMode('none');
    setMediaUri(null);
    setMediaPreview(null);
    setSubmitted(false);
    setErrors({});
  }

  // ── Success screen ───────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.successCard, { backgroundColor: c.surface, ...tokens.shadowLg }]}>
          <View style={[styles.successIconWrap, { backgroundColor: c.success + '18' }]}>
            <Text style={styles.successIcon}>✅</Text>
          </View>
          <Text style={[styles.successTitle, { color: c.text }]}>Question Submitted</Text>
          <Text style={[styles.successBody, { color: c.textSecondary }]}>
            Your question is under review. You will be notified once it is approved.
          </Text>
          <View style={[styles.editNote, { backgroundColor: c.warning + '15' }]}>
            <Text style={[styles.editNoteText, { color: c.warning }]}>
              ⏱ Edit window: {EDIT_WINDOW_SEC}s after submission
            </Text>
          </View>
          <Button title="Submit Another Question" onPress={reset} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Ask a Question</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Submit your agriculture-related query
            </Text>
          </View>

          {/* Daily limit badge */}
          <View style={[styles.limitBadge, { backgroundColor: remainingToday > 5 ? c.success + '18' : c.warning + '18' }]}>
            <Text style={[styles.limitBadgeText, { color: remainingToday > 5 ? c.success : c.warning }]}>
              {remainingToday > 0
                ? `${remainingToday} of ${DAILY_QUESTION_LIMIT} submissions remaining today`
                : `Daily limit of ${DAILY_QUESTION_LIMIT} reached — come back tomorrow`}
            </Text>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>

            {/* ── Location section ── */}
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>📍 Location</Text>

            {missingProfileFields && (
              <View style={[styles.profilePrompt, { backgroundColor: c.warning + '18', borderColor: c.warning + '40' }]}>
                <Text style={[styles.profilePromptText, { color: c.warning }]}>
                  Complete your profile (state + district) to submit questions.
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                  <Text style={[styles.profilePromptLink, { color: c.warning }]}>Go to Profile →</Text>
                </TouchableOpacity>
              </View>
            )}

            <Select
              label="State"
              value={state}
              options={stateOptions}
              onChange={(v) => { setState(v); setErrors({}); }}
              error={errors.state}
            />
            <Input
              label="District"
              placeholder="e.g., Bhubaneswar, Belgaum"
              value={district}
              onChangeText={(t) => { setDistrict(t); setErrors({}); }}
              error={errors.district}
            />
            <Input
              label="Block / Mandal (Optional)"
              placeholder="e.g., Tangi, Gokak"
              value={block}
              onChangeText={setBlock}
            />

            {/* Auto-derived zone */}
            {state && (
              <View style={[styles.zoneTag, { backgroundColor: c.muted }]}>
                <Text style={[styles.zoneTagLabel, { color: c.textSecondary }]}>Agro-Climatic Zone</Text>
                <Text style={[styles.zoneTagValue, { color: c.text }]}>
                  {AGRO_CLIMATIC_ZONE_LABELS[agroClimaticZone]}
                </Text>
              </View>
            )}

            {/* ── Question section ── */}
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>🌾 Question Details</Text>

            <Select
              label="Agriculture Domain"
              placeholder="Select domain"
              value={domainCategory}
              options={domainOptions}
              onChange={(v) => { setDomainCategory(v); setErrors({}); }}
              error={errors.domainCategory}
            />
            <Select
              label="Season"
              placeholder="Select season"
              value={season}
              options={seasonOptions}
              onChange={(v) => { setSeason(v); setErrors({}); }}
              error={errors.season}
            />
            <Input
              label="Crop Type"
              placeholder="e.g., Rice, Wheat, Cotton, Maize"
              value={cropType}
              onChangeText={(t) => { setCropType(t); setErrors({}); }}
              error={errors.cropType}
            />
            <Input
              label="Your Question"
              placeholder="Type your agriculture question here…"
              value={questionText}
              onChangeText={(t) => { setQuestionText(t); setErrors({}); }}
              error={errors.questionText}
              multiline
              numberOfLines={5}
              style={{ height: 120, textAlignVertical: 'top', paddingTop: tokens.spacing3 }}
            />

            {/* ── Media section ── */}
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>📎 Media (optional)</Text>

            {mediaPreview ? (
              <View style={styles.mediaPreview}>
                {mediaMode === 'image' && (
                  <Image source={{ uri: mediaPreview }} style={styles.previewImage} resizeMode="cover" />
                )}
                {mediaMode === 'video' && (
                  <View style={[styles.previewPlaceholder, { backgroundColor: c.muted }]}>
                    <Text style={{ color: c.textSecondary }}>🎥 Video attached</Text>
                  </View>
                )}
                <TouchableOpacity onPress={handleRemoveMedia} style={[styles.removeBtn, { backgroundColor: c.error }]}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mediaButtons}>
                <TouchableOpacity
                  style={[styles.mediaBtn, { backgroundColor: c.muted }]}
                  onPress={handleAttachImage}
                  disabled={uploadingMedia || loading}
                >
                  <Text style={styles.mediaBtnText}>📷 Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mediaBtn, { backgroundColor: c.muted }]}
                  onPress={handleAttachVideo}
                  disabled={uploadingMedia || loading}
                >
                  <Text style={styles.mediaBtnText}>🎥 Video ({EDIT_WINDOW_SEC}s, 10 MB)</Text>
                </TouchableOpacity>
              </View>
            )}

            {uploadingMedia && (
              <Text style={[styles.uploadText, { color: c.textSecondary }]}>⏳ Uploading media…</Text>
            )}

            <View style={[styles.mediaHint, { backgroundColor: c.muted }]}>
              <Text style={[styles.mediaHintText, { color: c.textSecondary }]}>
                Video: max {EDIT_WINDOW_SEC}s, 10 MB
              </Text>
            </View>

            <Button
              title={loading ? 'Submitting…' : 'Submit Question'}
              onPress={handleSubmit}
              loading={loading || uploadingMedia}
              disabled={remainingToday <= 0}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1 },
  flex:         { flex: 1 },
  scroll:       { flexGrow: 1, padding: tokens.spacing6 },
  header:       { marginBottom: tokens.spacing4 },
  title:        { fontSize: 26, fontWeight: '800' },
  subtitle:     { fontSize: 13, marginTop: tokens.spacing1, lineHeight: 18 },
  limitBadge:   { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing4 },
  limitBadgeText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  card:         { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: tokens.spacing2, marginTop: tokens.spacing3 },
  profilePrompt: {
    borderWidth: 1,
    borderRadius: tokens.radiusMd,
    padding: tokens.spacing3,
    marginBottom: tokens.spacing3,
  },
  profilePromptText: { fontSize: 13, fontWeight: '500', marginBottom: tokens.spacing1 },
  profilePromptLink: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  zoneTag:       { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing3 },
  zoneTagLabel:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  zoneTagValue:  { fontSize: 14, fontWeight: '600', marginTop: 2 },
  mediaPreview:  { position: 'relative', marginBottom: tokens.spacing2, borderRadius: tokens.radiusMd, overflow: 'hidden' },
  previewImage:  { width: '100%', height: 160, borderRadius: tokens.radiusMd },
  previewPlaceholder: { width: '100%', height: 80, borderRadius: tokens.radiusMd, alignItems: 'center', justifyContent: 'center' },
  removeBtn:     { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  mediaButtons:  { flexDirection: 'row', gap: tokens.spacing2, marginBottom: tokens.spacing2 },
  mediaBtn:      { flex: 1, borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing3, alignItems: 'center' },
  mediaBtnText:  { fontSize: 13, fontWeight: '600' },
  uploadText:    { fontSize: 12, marginBottom: tokens.spacing2, textAlign: 'center' },
  mediaHint:     { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing4 },
  mediaHintText: { fontSize: 12, letterSpacing: 0.12 },
  successCard:   { flex: 1, justifyContent: 'center', alignItems: 'center', margin: tokens.spacing6, borderRadius: tokens.radiusXl, padding: tokens.spacing8 },
  successIconWrap: { width: 80, height: 80, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing5 },
  successIcon:   { fontSize: 40 },
  successTitle:  { fontSize: 22, fontWeight: '800', marginBottom: tokens.spacing3 },
  successBody:   { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: tokens.spacing5 },
  editNote:      { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing5, width: '100%' },
  editNoteText:  { fontSize: 13, textAlign: 'center', fontWeight: '500' },
});