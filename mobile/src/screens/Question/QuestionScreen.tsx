import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { questionApi } from '../../api/client';
import { LANGUAGES, SEASONS, DOMAIN_CATEGORIES, EDIT_WINDOW_SEC } from '../../utils/constants';
import { tokens } from '../../utils/theme';

const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));
const seasonOptions = SEASONS.map((s) => ({ value: s.value, label: s.label }));
const domainOptions = DOMAIN_CATEGORIES.map((d) => ({ value: d.value, label: d.label }));

export function QuestionScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();

  const [language, setLanguage] = useState(user?.languagePreference ?? 'hi');
  const [domainCategory, setDomainCategory] = useState('');
  const [season, setSeason] = useState('');
  const [cropType, setCropType] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!domainCategory) errs.domainCategory = 'Select a domain category';
    if (!season) errs.season = 'Select a season';
    if (!cropType.trim()) errs.cropType = 'Enter the crop type';
    if (!questionText.trim()) errs.questionText = 'Enter your question';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      await questionApi.submit({
        language,
        domainCategory,
        season,
        cropType: cropType.trim(),
        questionText: questionText.trim(),
        state: user?.state ?? '',
        district: user?.district ?? '',
        block: user?.block ?? '',
        submittedAt: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to submit question. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setDomainCategory('');
    setSeason('');
    setCropType('');
    setQuestionText('');
    setSubmitted(false);
    setErrors({});
  }

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Ask a Question</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Submit your agriculture-related query in your preferred language
            </Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, { backgroundColor: c.surface, ...tokens.shadowMd }]}>
            <Select
              label="Language"
              value={language}
              options={languageOptions}
              onChange={setLanguage}
            />
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
              placeholder="e.g., Rice, Wheat, Cotton"
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

            {/* Media hint */}
            <View style={[styles.mediaHint, { backgroundColor: c.muted }]}>
              <Text style={[styles.mediaHintText, { color: c.textSecondary }]}>
                📹 Video submissions: Max {EDIT_WINDOW_SEC}s, 10 MB
              </Text>
            </View>

            <Button title="Submit Question" onPress={handleSubmit} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: tokens.spacing6 },
  header: { marginBottom: tokens.spacing5 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: tokens.spacing1, lineHeight: 18 },
  card: { borderRadius: tokens.radiusXl, padding: tokens.spacing6 },
  mediaHint: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing4 },
  mediaHintText: { fontSize: 12, letterSpacing: 0.01 * 12 },
  successCard: { flex: 1, justifyContent: 'center', alignItems: 'center', margin: tokens.spacing6, borderRadius: tokens.radiusXl, padding: tokens.spacing8 },
  successIconWrap: { width: 80, height: 80, borderRadius: tokens.radiusFull, alignItems: 'center', justifyContent: 'center', marginBottom: tokens.spacing5 },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: tokens.spacing3 },
  successBody: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: tokens.spacing5 },
  editNote: { borderRadius: tokens.radiusMd, padding: tokens.spacing3, marginBottom: tokens.spacing5, width: '100%' },
  editNoteText: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
});