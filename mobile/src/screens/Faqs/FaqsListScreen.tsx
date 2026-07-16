import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { faqApi } from '../../api/client';
import { VideoSection } from '../../components/VideoSection';
import { Faq } from '../../types';
import { tokens } from '../../utils/theme';
import { RootStackParamList } from '../../navigation/types';
import i18n from '../../i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Category config ──────────────────────────────────────────────────────────

interface Category {
  key: string;
  label: string;
  icon: string;
  color: string;
  keywords: string[];
}

const BASE_CATEGORIES = [
  {
    key: 'account',
    icon: 'person-outline',
    color: '#4A90D9',
    keywords: ['account', 'login', 'password', 'register', 'signup', 'profile', 'email', 'phone'],
  },
  {
    key: 'payment',
    icon: 'wallet-outline',
    color: '#27AE60',
    keywords: ['payment', 'pay', 'withdraw', 'withdrawal', 'money', 'wallet', 'reward', 'incentive', 'kisan', 'coin'],
  },
  {
    key: 'question',
    icon: 'help-circle-outline',
    color: '#E67E22',
    keywords: ['question', 'ask', 'submit', 'crop', 'report', 'issue', 'problem', 'farming', 'crop'],
  },
  {
    key: 'general',
    icon: 'information-circle-outline',
    color: '#8E44AD',
    keywords: [],
  },
];

function detectCategory(item: Faq): Category {
  const text = `${item.question} ${item.answer}`.toLowerCase();
  for (const cat of BASE_CATEGORIES) {
    if (cat.key === 'general') continue;
    if (cat.keywords.some((kw) => text.includes(kw))) return { ...cat, label: cat.key } as Category;
  }
  return { ...BASE_CATEGORIES.find((c) => c.key === 'general')!, label: 'general' } as Category;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupedFaqs {
  category: Category;
  items: Faq[];
}

interface FaqItemProps {
  item: Faq;
  index: number;
  isLast: boolean;
  catColor: string;
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ item, index, isLast, catColor }: FaqItemProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  }, []);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.72}
        style={[styles.item, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={toggle}
      >
        {/* Colored left indicator */}
        <View style={[styles.itemIndicator, { backgroundColor: catColor }]} />

        {/* Question */}
        <View style={styles.itemContent}>
          <Text
            style={[styles.question, { color: c.text }]}
            numberOfLines={open ? undefined : 2}
          >
            {item.question}
          </Text>

          {open && (
            <View style={[styles.answerWrap, { borderTopColor: c.border }]}>
              <Text style={[styles.answer, { color: c.textSecondary }]}>
                {item.answer}
              </Text>
            </View>
          )}
        </View>

        {/* Chevron */}
        <View style={styles.chevronWrap}>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={c.textTertiary}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ $t }: { $t: (k: string) => string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconWrap, { backgroundColor: c.surfaceVariant }]}>
        <Ionicons
          name="help-circle-outline"
          size={40}
          color={c.textTertiary}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]}>
        {$t('faq.emptyTitle')}
      </Text>
      <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>
        {$t('faq.emptySubtitle')}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function FaqsListScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<Nav>();

  const [items, setItems] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const $t = (k: string) => i18n.t(k);

  const fetch_ = useCallback(async (filters?: { category?: string }) => {
    try {
      const res = await faqApi.getVisible(filters);
      setItems(res.data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetch_(); }, [fetch_]);

  // Category filter
  useEffect(() => {
    setLoading(true);
    fetch_({ category: activeCategory ?? undefined });
  }, [activeCategory, fetch_]);

  async function onRefresh() {
    setRefreshing(true);
    await fetch_({ category: activeCategory ?? undefined });
  }

  // Group results by category
  const CATEGORIES: Category[] = BASE_CATEGORIES.map((cat) => ({
    ...cat,
    label: $t(`faqCategory.${cat.key}`),
  }));

  const grouped = useMemo<GroupedFaqs[]>(() => {
    if (items.length === 0) return [];
    const groups: Map<string, Faq[]> = new Map();
    for (const item of items) {
      const catKey = item.category ?? detectCategory(item).key;
      if (!groups.has(catKey)) groups.set(catKey, []);
      groups.get(catKey)!.push(item);
    }
    return CATEGORIES.filter((cat) => groups.has(cat.key))
      .map((cat) => ({ category: cat, items: groups.get(cat.key)! }));
  }, [items]);

  function toggleCategory(key: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory((prev) => (prev === key ? null : key));
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: c.text }]}>{$t('faq.title')}</Text>
        <View style={styles.topBarRight} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} />
          }
        >
          {/* Category chips */}
          <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    activeOpacity={0.72}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isActive ? cat.color : c.surfaceVariant,
                        borderColor: isActive ? cat.color : c.border,
                      },
                    ]}
                    onPress={() => toggleCategory(cat.key)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={isActive ? '#fff' : cat.color}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isActive ? '#fff' : c.text },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          {/* FAQ groups */}
          {grouped.length === 0 ? (
            <EmptyState $t={$t} />
          ) : (
            grouped.map(({ category, items: catItems }) => (
              <View key={category.key} style={styles.group}>
                {/* Group header */}
                <View style={styles.groupHeader}>
                  <View style={[styles.groupIcon, { backgroundColor: category.color + '18' }]}>
                    <Ionicons name={category.icon as any} size={16} color={category.color} />
                  </View>
                  <Text style={[styles.groupTitle, { color: c.text }]}>
                    {category.label}
                  </Text>
                  <Text style={[styles.groupCount, { color: c.textTertiary }]}>
                    {catItems.length} {i18n.t('faq.group.article', { count: catItems.length })}
                  </Text>
                </View>

                {/* Items */}
                <View style={[styles.groupList, { backgroundColor: c.surface, borderColor: c.border }]}>
                  {catItems.map((item, i) => (
                    <FaqItem
                      key={item.id}
                      item={item}
                      index={i}
                      isLast={i === catItems.length - 1}
                      catColor={category.color}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Floating video button — always visible */}
      <VideoSection />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: tokens.spacing6,
  },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: tokens.spacing2, paddingVertical: tokens.spacing2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  topBarRight: { width: 40 },

  /* ── Category chips ── */
  categoryChips: {
    flexDirection: 'row',
    gap: tokens.spacing2,
    paddingHorizontal: tokens.spacing4,
    paddingVertical: tokens.spacing3,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Group ── */
  group: {
    marginTop: tokens.spacing4,
    paddingHorizontal: tokens.spacing4,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing2,
    marginBottom: tokens.spacing2,
  },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  groupCount: {
    fontSize: 12,
  },
  groupList: {
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  /* ── FAQ Item ── */
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: tokens.spacing4,
    paddingHorizontal: tokens.spacing4,
    gap: tokens.spacing3,
  },
  itemIndicator: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  itemContent: {
    flex: 1,
    gap: tokens.spacing2,
  },
  question: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  chevronWrap: {
    paddingTop: 2,
    flexShrink: 0,
  },
  answerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: tokens.spacing3,
  },
  answer: {
    fontSize: 14,
    lineHeight: 21,
  },

  /* ── Empty state ── */
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: tokens.spacing8,
    paddingHorizontal: tokens.spacing4,
    gap: tokens.spacing3,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});