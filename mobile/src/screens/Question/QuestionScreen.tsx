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
  TouchableOpacity,
} from 'react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { LANGUAGES, SEASONS, DOMAIN_CATEGORIES, EDIT_WINDOW_SEC } from '../../utils/constants';
import { questionApi } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));
const seasonOptions = SEASONS.map((s) => ({ value: s.value, label: s.label }));
const domainOptions = DOMAIN_CATEGORIES.map((d) => ({ value: d.value, label: d.label }));

export function QuestionScreen() {
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
    if (!cropType.trim()) errs.cropType = 'Enter crop type';
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
      <SafeAreaView style={styles.container}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Question Submitted!</Text>
          <Text style={styles.successBody}>
            Your question is being reviewed. You will be notified once it is approved.
          </Text>
          <View style={styles.editNote}>
            <Text style={styles.editNoteText}>
              ⏱️ You have {EDIT_WINDOW_SEC} seconds to edit your question after submission.
            </Text>
          </View>
          <Button title="Submit Another" onPress={reset} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Ask a Question</Text>
            <Text style={styles.subtitle}>
              Submit your agriculture-related question in your preferred language
            </Text>
          </View>

          <View style={styles.card}>
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
              placeholder="Type your agriculture question here..."
              value={questionText}
              onChangeText={(t) => { setQuestionText(t); setErrors({}); }}
              error={errors.questionText}
              multiline
              numberOfLines={5}
              style={styles.textArea}
              textAlignVertical="top"
            />

            <View style={styles.mediaHint}>
              <Text style={styles.mediaHintText}>📹 Video submissions: Max 10 seconds, 10 MB</Text>
            </View>

            <Button title="Submit Question" onPress={handleSubmit} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1B5E20' },
  subtitle: { fontSize: 13, color: '#558B2F', marginTop: 4, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  textArea: { height: 120, paddingTop: 12 },
  mediaHint: {
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  mediaHintText: { fontSize: 12, color: '#F57F17' },
  successCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F1F8E9',
  },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1B5E20', marginBottom: 12 },
  successBody: { fontSize: 14, color: '#616161', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  editNote: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  editNoteText: { fontSize: 13, color: '#E65100', textAlign: 'center' },
});