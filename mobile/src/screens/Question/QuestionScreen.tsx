import React, { useState, useEffect } from 'react';
import { RouteProp } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { questionApi } from '../../api/client';
import {
  SEASONS,
  DOMAIN_CATEGORIES,
  INDIAN_STATES,
  DAILY_QUESTION_LIMIT,
  EDIT_WINDOW_SEC,
} from '../../utils/constants';
import { tokens } from '../../utils/theme';
import { MainTabParamList } from '../../navigation/types';
import { compressImage, compressVideo, uploadToStorage, validateVideo } from '../../utils/media';

// ─── Media picker stubs (install expo-image-picker + expo-video-thumbnails to enable) ───
type MediaMode = 'none' | 'image' | 'video' | 'audio';

interface PickerResult {
  cancelled: boolean;
  uri?: string;
  width?: number;
  height?: number;
  type?: 'image' | 'video' | 'audio';
  fileSize?: number;
}

// Conditional import — resolved at runtime when the native module is available.
// try/catch handles both "not installed" (TS path) and "native binary unavailable" (Expo Go).
async function pickImage(): Promise<PickerResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-image-picker');
    const result = await mod.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return { cancelled: true };
    const asset = result.assets[0];
    return { cancelled: false, uri: asset.uri, fileSize: asset.fileSize, type: 'image' };
  } catch {
    return { cancelled: true };
  }
}

async function pickVideo(): Promise<PickerResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-image-picker');
    const result = await mod.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.6,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return { cancelled: true };
    const asset = result.assets[0];
    return { cancelled: false, uri: asset.uri, fileSize: asset.fileSize, type: 'video' };
  } catch {
    return { cancelled: true };
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const seasonOptions = SEASONS.map((s) => ({ value: s.value, label: s.label }));
const domainOptions = DOMAIN_CATEGORIES.map((d) => ({ value: d.value, label: d.label }));
const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));

// ─── Component ─────────────────────────────────────────────────────────────────

interface QuestionScreenProps {
  route?: RouteProp<MainTabParamList, 'AskQuestion'>;
}

interface Question {
  id: string;
  questionText: string;
  domainCategory: string;
  season: string;
  cropType: string;
  state: string;
  district: string;
  block?: string | null;
  mediaType: 'none' | 'image' | 'video' | 'audio';
  mediaUrls?: string[] | null;
  editWindowClosesAt: string | null;
}

export function QuestionScreen({ route }: QuestionScreenProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const navigation = useNavigation();

  const editingQuestionId = route?.params?.questionId;
  const isEditMode = Boolean(editingQuestionId);

  // Form state
  const [state, setState] = useState(user?.state ?? '');
  const [district, setDistrict] = useState(user?.district ?? '');
  const [block, setBlock] = useState(user?.block ?? '');
  const [domainCategory, setDomainCategory] = useState('');
  const [season, setSeason] = useState('');
  const [cropType, setCropType] = useState('');
  const [questionText, setQuestionText] = useState('');

  // Media state
  const [mediaMode, setMediaMode] = useState<MediaMode>('none');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Stats
  const [dailyCount, setDailyCount] = useState(0);
  const [remainingToday, setRemainingToday] = useState(DAILY_QUESTION_LIMIT);

  // Load stats on mount; fetch question if editing
  useEffect(() => {
    if (isEditMode && editingQuestionId) {
      questionApi.get(editingQuestionId).then((res) => {
        const q = res.data as Question;
        setState(q.state ?? '');
        setDistrict(q.district ?? '');
        setBlock(q.block ?? '');
        setDomainCategory(q.domainCategory);
        setSeason(q.season);
        setCropType(q.cropType);
        setQuestionText(q.questionText);
        if (q.mediaUrls?.length) {
          setMediaPreview(q.mediaUrls[0]);
          setMediaMode(q.mediaType);
        }
      }).catch(async (err) => {
        console.log('[QuestionScreen] fetch error:', err);
        const { getErrorMessage } = await import('../../api/client');
        Alert.alert('Error', getErrorMessage(err, 'Could not load question to edit.'));
        navigation.navigate('Submissions' as never);
      });
    } else {
      questionApi
        .getStats()
        .then((res) => {
          const data = res.data as { dailyCount: number; remainingToday: number };
          setDailyCount(data.dailyCount);
          setRemainingToday(data.remainingToday);
        })
        .catch(() => {
          // Non-fatal — show default limits
        });
    }
  }, [isEditMode, editingQuestionId]);

  // ─── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!state) errs.state = 'Select your state';
    if (!district.trim()) errs.district = 'Enter your district';
    if (!domainCategory) errs.domainCategory = 'Select a domain category';
    if (!season) errs.season = 'Select a season';
    if (!cropType.trim()) errs.cropType = 'Enter the crop type';
    if (!questionText.trim() && mediaMode === 'none') {
      errs.questionText = 'Enter your question or attach media';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Media handlers ──────────────────────────────────────────────────────────

  async function handleAttachImage() {
    setMediaMode('image');
    const result = await pickImage();
    if (result.cancelled || !result.uri) {
      setMediaMode('none');
      return;
    }

    const compressedUri = await compressImage(result.uri);
    setMediaUri(compressedUri);
    setMediaPreview(result.uri);
    setErrors({});
  }

  async function handleAttachVideo() {
    setMediaMode('video');
    const result = await pickVideo();
    if (result.cancelled || !result.uri) {
      setMediaMode('none');
      return;
    }

    // Validate file size
    const validation = validateVideo(result.fileSize ?? 0);
    if (!validation.valid) {
      Alert.alert('Video Too Large', validation.error);
      setMediaMode('none');
      return;
    }

    const compressedUri = await compressVideo(result.uri);
    setMediaUri(compressedUri);
    setMediaPreview(result.uri);
    setErrors({});
  }

  function handleRemoveMedia() {
    setMediaMode('none');
    setMediaUri(null);
    setMediaPreview(null);
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validate()) return;

    if (!isEditMode && remainingToday <= 0) {
      Alert.alert(
        'Daily Limit Reached',
        `You have reached your limit of ${DAILY_QUESTION_LIMIT} questions today. Please try again tomorrow.`,
      );
      return;
    }

    setLoading(true);
    try {
      let mediaUrls: string[] | undefined;

      // Upload new media if present and changed (edit mode)
      if (mediaUri && user?.id) {
        setUploadingMedia(true);
        try {
          const url = await uploadToStorage(mediaUri, mediaMode as 'image' | 'video' | 'audio', user.id);
          mediaUrls = [url];
        } catch (err) {
          const { getErrorMessage } = await import('../../api/client');
          Alert.alert('Upload Failed', getErrorMessage(err, 'Failed to upload media. Please try again.'));
          setLoading(false);
          setUploadingMedia(false);
          return;
        } finally {
          setUploadingMedia(false);
        }
      }

      const payload = {
        state,
        district: district.trim(),
        block: block.trim() || null,
        domainCategory,
        season,
        cropType: cropType.trim(),
        questionText: questionText.trim(),
        mediaType: mediaMode,
        mediaUrls,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
        },
      };

      if (isEditMode && editingQuestionId) {
        await questionApi.update(editingQuestionId, payload);
      } else {
        await questionApi.submit(payload);
      }
      setSubmitted(true);

      // Refresh stats only for new submissions
      if (!isEditMode) {
        const res = await questionApi.getStats();
        const stats = res.data as { dailyCount: number; remainingToday: number };
        setDailyCount(stats.dailyCount);
        setRemainingToday(stats.remainingToday);
      }
    } catch (err: unknown) {
      const { getErrorMessage } = await import('../../api/client');
      const msg = getErrorMessage(err, 'Failed to submit. Please try again.');
      Alert.alert('Submit Error', msg);
    } finally {
      setLoading(false);
      setUploadingMedia(false);
    }
  }

  // ─── Reset ───────────────────────────────────────────────────────────────────

  function reset() {
    setState(user?.state ?? '');
    setDistrict(user?.district ?? '');
    setBlock(user?.block ?? '');
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

  // ─── Render: Success ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.successCard, { backgroundColor: c.surface, ...tokens.shadowLg }]}>
          <View style={[styles.successIconWrap, { backgroundColor: c.success + '18' }]}>
            <Ionicons name="checkmark-circle" size={40} color={c.success} />
          </View>
          <Text style={[styles.successTitle, { color: c.text }]}>
            {isEditMode ? 'Question Updated' : 'Question Submitted'}
          </Text>
          <Text style={[styles.successBody, { color: c.textSecondary }]}>
            Your question is under review. You will be notified once it is approved.
          </Text>
          <Button
            title={isEditMode ? 'Back to Submissions' : 'Submit Another Question'}
            onPress={() => {
              if (isEditMode) {
                navigation.navigate('Submissions' as never);
              } else {
                reset();
              }
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: Form ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>
            {isEditMode ? 'Edit Question' : 'Ask a Question'}
          </Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              {isEditMode ? 'Update your question within the edit window' : 'Submit your agriculture-related query'}
            </Text>
          </View>

          {/* Daily limit badge — hide in edit mode */}
          {!isEditMode && (
            <View style={[styles.limitBadge, { backgroundColor: remainingToday > 5 ? c.success + '18' : c.warning + '18' }]}>
              <Text style={[styles.limitBadgeText, { color: remainingToday > 5 ? c.success : c.warning }]}>
                {remainingToday > 0
                  ? `${remainingToday} of ${DAILY_QUESTION_LIMIT} submissions remaining today`
                  : `Daily limit of ${DAILY_QUESTION_LIMIT} reached — come back tomorrow`}
              </Text>
            </View>
          )}

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            {/* Location */}
            <Select
              label="State"
              value={state}
              options={stateOptions}
              onChange={(v) => { setState(v); setErrors({}); }}
              error={errors.state}
              searchable
            />
            <Input
              label="District"
              placeholder="Enter your district"
              value={district}
              onChangeText={(t) => { setDistrict(t); setErrors({}); }}
              error={errors.district}
            />
            <Input
              label="Block / Mandal (Optional)"
              placeholder="Enter your block or mandal"
              value={block}
              onChangeText={setBlock}
            />

            {/* Domain */}
            <Select
              label="Agriculture Domain"
              placeholder="Select domain"
              value={domainCategory}
              options={domainOptions}
              onChange={(v) => { setDomainCategory(v); setErrors({}); }}
              error={errors.domainCategory}
            />

            {/* Season */}
            <Select
              label="Season"
              placeholder="Select season"
              value={season}
              options={seasonOptions}
              onChange={(v) => { setSeason(v); setErrors({}); }}
              error={errors.season}
            />

            {/* Crop */}
            <Input
              label="Crop Type"
              placeholder="e.g., Rice, Wheat, Cotton"
              value={cropType}
              onChangeText={(t) => { setCropType(t); setErrors({}); }}
              error={errors.cropType}
            />

            {/* Question text */}
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

            {/* Media section */}
            <View style={styles.mediaSection}>
              <Text style={[styles.mediaLabel, { color: c.textSecondary }]}>Attach Media (optional)</Text>

              {/* Preview */}
              {mediaPreview && (
                <View style={styles.mediaPreview}>
                  {mediaMode === 'image' && (
                    <Image source={{ uri: mediaPreview }} style={styles.previewImage} resizeMode="cover" />
                  )}
                  {mediaMode === 'video' && (
                    <View style={[styles.previewPlaceholder, { backgroundColor: c.muted }]}>
                      <Ionicons name="videocam" size={28} color={c.textSecondary} />
                      <Text style={[styles.previewPlaceholderText, { color: c.textSecondary }]}>Video attached</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={handleRemoveMedia} style={[styles.removeBtn, { backgroundColor: c.error }]}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Pickers */}
              {!mediaPreview && (
                <View style={styles.mediaButtons}>
                  <TouchableOpacity
                    style={[styles.mediaBtn, { backgroundColor: c.muted }]}
                    onPress={handleAttachImage}
                    disabled={uploadingMedia || loading}
                  >
                    <Ionicons name="image" size={18} color={c.text} />
                    <Text style={styles.mediaBtnText}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mediaBtn, { backgroundColor: c.muted }]}
                    onPress={handleAttachVideo}
                    disabled={uploadingMedia || loading}
                  >
                    <Ionicons name="videocam" size={18} color={c.text} />
                    <Text style={styles.mediaBtnText}>Video ({EDIT_WINDOW_SEC}s, 10 MB)</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Upload progress */}
            {uploadingMedia && (
              <Text style={[styles.uploadText, { color: c.textSecondary }]}>
                ⏳ Uploading media…
              </Text>
            )}

            {/* Media hint */}
            <View style={[styles.mediaHint, { backgroundColor: c.muted }]}>
              <Text style={[styles.mediaHintText, { color: c.textSecondary }]}>
                Video submissions: max {EDIT_WINDOW_SEC}s, 10 MB
              </Text>
            </View>

            <Button
              title={loading ? (isEditMode ? 'Updating…' : 'Submitting…') : (isEditMode ? 'Update Question' : 'Submit Question')}
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

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: tokens.spacing6 },
  header: { marginBottom: tokens.spacing4 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1, lineHeight: 18 },
  limitBadge: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing4 },
  limitBadgeText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  mediaSection: { marginBottom: tokens.spacing4 },
  mediaLabel: { fontSize: 13, fontWeight: '500', marginBottom: tokens.spacing2 },
  mediaPreview: { position: 'relative', marginBottom: tokens.spacing2, borderRadius: tokens.radiusMd, overflow: 'hidden' },
  previewImage: { width: '100%', height: 160, borderRadius: tokens.radiusMd },
  previewPlaceholder: { width: '100%', height: 80, borderRadius: tokens.radiusMd, alignItems: 'center', justifyContent: 'center' },
  removeBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  mediaButtons: { flexDirection: 'row', gap: tokens.spacing2 },
  mediaBtn: { flex: 1, borderRadius: tokens.radiusMd, paddingVertical: tokens.spacing3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: tokens.spacing2 },
  mediaBtnText: { fontSize: 13, fontWeight: '600' },
  uploadText: { fontSize: 12, marginBottom: tokens.spacing2, textAlign: 'center' },
  mediaHint: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing4 },
  mediaHintText: { fontSize: 12, letterSpacing: 0.12 },
  successCard: { flex: 1, justifyContent: 'center', alignItems: 'center', margin: tokens.spacing6, borderRadius: tokens.radiusXl, padding: tokens.spacing8 },
  successIconWrap: { width: 80, height: 80, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing5 },
  previewPlaceholderText: { fontSize: 13, marginTop: tokens.spacing1 },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: tokens.spacing3 },
  successBody: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: tokens.spacing5 },
  editNote: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing5, width: '100%' },
  editNoteText: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
});