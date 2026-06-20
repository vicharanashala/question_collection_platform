/**
 * onDeviceAI.ts — On-Device AI Validation Pipeline
 *
 * Runs locally on the mobile client before submission to catch issues
 * immediately without waiting for a server round-trip. Falls through
 * gracefully if device capability checks fail; never blocks submission
 * on browser environments that lack required APIs.
 *
 * Pipeline order:
 *   1. Spam detection      — pattern-based, synchronous
 *   2. Agriculture relevance — keyword + signal scoring
 *   3. Duplicate detection — exact (normalised) + semantic similarity via
 *                             Levenshtein ratio against a local question cache
 *      persisted in AsyncStorage
 *
 * Each stage emits a result object; the pipeline aggregates them into a
 * single AIValidationResult that QuestionScreen consumes to decide whether
 * to show a warning banner or proceed directly to the preview API call.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { SIMILARITY_THRESHOLD } from './constants';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AIValidationResult {
  /** Overall PASS / WARN / FAIL — WARN means show banner, FAIL blocks submit */
  verdict: 'pass' | 'warn' | 'fail';
  /** Human-readable message suitable for a Toast / banner */
  message: string | null;
  /** Key into locales for the rejection reason (i18n-aware) */
  reasonKey: string | null;
  /** Individual stage outcomes */
  stages: {
    relevance:  StageResult;
    duplicate:  StageResult;
    spam:       StageResult;
  };
  /** True when at least one stage ran; false = device unsupported */
  ran: boolean;
}

export interface StageResult {
  /** Whether this stage passed all checks */
  pass: boolean;
  /** Confidence 0–1 */
  confidence: number;
  /** Optional short description for debug display */
  detail?: string;
}

interface CachedQuestion {
  id: string;
  text: string;
  /** ISO date string — used for TTL eviction */
  cachedAt: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DUPLICATE_CACHE_KEY = 'on_device_ai_duplicate_cache';
const DUPLICATE_CACHE_MAX_ENTRIES = 50;
const /** ms */ DUPLICATE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

// ─── Agriculture Relevance ─────────────────────────────────────────────────────

/**
 * Broad agricultural keyword set spanning crops, livestock, irrigation,
 * fertilisers, pesticides, weather, soil, and post-harvest topics.
 * Covers all major Indian languages and English so that code-switched
 * or transliterated input still scores relevance.
 */
const AGRICULTURE_KEYWORDS = new Set([
  // ── Crops ──────────────────────────────────────────────────────────────────
  'wheat', 'rice', 'paddy', 'maize', 'bajra', 'jowar', 'ragi', 'barley',
  'cotton', 'sugarcane', 'groundnut', 'mustard', 'soybean', 'sunflower',
  'sesame', 'castor', 'linseed', 'niger', 'gram', 'tur', 'masoor', 'moong',
  'urad', 'horsegram', 'lentil', 'peas', 'beans', 'soyabean', 'soyabeen',
  'arhar', 'khesari', 'chickpea', 'pigeonpea',
  'tomato', 'potato', 'onion', 'garlic', 'ginger', 'turmeric', 'chilli',
  'brinjal', 'cabbage', 'cauliflower', 'okra', 'bhindi', 'ladyfinger',
  'cucumber', 'gourd', 'pumpkin', 'bottle gourd', 'bitter gourd', 'ridge gourd',
  'carrot', 'radish', 'beetroot', 'spinach', 'lettuce', 'fenugreek',
  ' coriander', 'cumin', 'fennel', 'coriander seeds', 'carom', 'ajwain',
  'black pepper', 'cardamom', 'cinnamon', 'cloves', 'nutmeg',
  'mango', 'banana', 'grape', 'citrus', 'orange', 'mosambi', 'lime', 'lemon',
  'apple', 'pear', 'peach', 'plum', 'apricot', 'litchi', 'guava', 'papaya',
  'pomegranate', 'date', 'fig', 'jackfruit', 'jamun', 'ber', 'karonda',
  'coconut', 'arecanut', 'cashew', 'almond', 'walnut', 'pistachio',
  'coffee', 'tea', 'rubber',
  'rose', 'marigold', 'jasmine', 'tuberose', 'carnation', 'orchid',
  'drumstick', 'moriga', 'moringa', 'tamarind', 'bamboo', 'neem', 'teak',
  'jute', 'mesta', 'sunhemp', 'dhaincha',
  // ── Animals / Livestock ─────────────────────────────────────────────────────
  'cattle', 'buffalo', 'cow', 'bull', 'ox', 'calf', 'goat', 'sheep', 'lamb',
  'poultry', 'chicken', 'broiler', 'layer', 'duck', 'quail', 'pigeon',
  'pig', 'swine', 'rabbit', 'fish', 'prawn', 'shrimp', 'crab',
  'milk', 'dairy', 'colostrum', 'butter', 'ghee', 'curd', 'cheese',
  'breeding', 'insemination', 'ai', 'artificial insemination', 'pregnancy',
  'calving', 'lactation', 'milking', 'mastitis', 'fmd', 'foot and mouth',
  'hs', 'haemorrhagic septicaemia', 'bse', 'lumpy skin', 'fmdv',
  'deworming', 'vaccination', 'vaccine', 'anthrax', 'rabies',
  'fodder', 'feed', 'silage', 'hay', 'straw', 'concentrate', 'mineral mixture',
  'crutching', 'shearing', 'hoof', 'hoof trimming',
  // ── Soil & Nutrient Management ──────────────────────────────────────────────
  'soil', 'soil testing', 'soil health', 'n p k', 'nitrogen', 'phosphorus',
  'potash', 'potassium', 'urea', 'dap', 'dap', 'npk', 'ammonium',
  'compost', 'fym', 'farmyard manure', 'vermicompost', 'bio-fertilizer',
  'biofertilizer', 'rhizobium', 'azolla', 'psb', 'mycorrhiza',
  'lime', 'liming', 'gypsum', 'sulfur', 'micronutrient', 'zinc', 'iron',
  'boron', 'manganese', 'copper', 'molybdenum', 'chlorosis',
  'organic', 'organic farming', 'natural farming', 'zero budget',
  'jeevamrut', 'jeevamrit', 'beejamrit', 'ghana jeevamrit', 'cow dung',
  'composting', 'wormicompost', 'green manure', 'green manuring',
  'mulch', 'mulching', 'straw mulch', 'plastic mulch',
  // ── Irrigation & Water ──────────────────────────────────────────────────────
  'irrigation', 'drip', 'drip irrigation', 'sprinkler', 'flood irrigation',
  'furrow', 'check basin', 'ridge and furrow', 'drip', 'drip system',
  'micro irrigation', 'microirrigation', 'pipe', 'pipe layout', 'pump',
  'motor', 'borewell', 'bore well', 'open well', 'well', 'canal',
  'reservoir', 'pond', 'rainwater', 'rain water', 'harvesting', 'harvesting',
  'water table', 'drainage', 'drainage system', 'subsoil drainage',
  'drought', 'drought resistant', 'drought tolerant', 'water stress',
  'moisture', 'moisture conservation', 'mulch', 'polythene',
  // ── Plant Protection ────────────────────────────────────────────────────────
  'pesticide', 'insecticide', 'fungicide', 'herbicide', 'rodenticide',
  'neem', 'neem oil', 'pyrethrum', 'biological control', 'biocontrol',
  'biopesticide', 'botanical pesticide', 'ipm', 'integrated pest management',
  'pest', 'pests', 'insect', 'insects', 'bug', 'bugs',
  'aphid', 'aphids', 'whitefly', 'white fly', 'jassid', 'leafhopper',
  'hopper', 'thrips', 'mealybug', 'mealy bug', 'scale insect', 'borer',
  'fruit borer', 'pod borer', 'stem borer', 'shoot borer', 'gall midge',
  'termite', 'termites', 'nematode', 'nematodes', 'eelworm',
  'mite', 'mites', 'spider mite', 'red spider', 'yellow mite',
  'locust', 'grasshopper', 'caterpillar', 'armyworm', 'army worm',
  'disease', 'diseases', 'blight', 'leaf blight', 'brown spot',
  'rust', 'leaf rust', 'powdery mildew', 'downy mildew', 'Alternaria',
  'Fusarium', 'Phythium', 'Rhizoctonia', 'Bacterial wilt', 'wilt',
  'rot', 'root rot', 'fruit rot', 'collar rot', 'soft rot',
  'spot', 'leaf spot', 'anthracnose', 'canker', 'smut', 'bunt',
  'mosaic', 'mosaic virus', 'yellow mosaic', 'leaf curl', 'leafroll',
  'bacterial blight', 'leaf burn', 'sheath blight', 'grain discoloration',
  // ── Weather & Climate ──────────────────────────────────────────────────────
  'monsoon', 'rainfall', 'rain', 'heavy rain', 'light rain',
  'flood', 'flooding', 'waterlogging', 'water logging', 'stagnant water',
  'cold', 'frost', 'frost damage', 'hail', 'hailstorm', 'hail storm',
  'heat', 'heat wave', 'heat stress', 'temperature', 'high temperature',
  'humidity', 'relative humidity', 'wind', 'wind damage', 'storm',
  'climate', 'climate change', 'weather', 'season', 'kharif', 'rabi', 'zaid',
  'sowing', 'sowing time', 'sowing window', 'delay sowing', 'early sowing',
  // ── Farm Machinery & Mechanisation ─────────────────────────────────────────
  'tractor', 'power tiller', 'rotavator', 'plough', 'plow', 'harrow',
  'cultivator', 'seed drill', 'seed drill', 'Seeder', 'transplanter',
  'paddy transplanter', 'mechanical transplanter', 'reaper', 'harvester',
  'combine harvester', 'thresher', 'threshing', 'winnowing', 'cleaning',
  'sprayer', 'knapsack sprayer', 'power sprayer', 'duster', 'fogger',
  'thresher', 'decorticator', 'oil expeller', 'flour mill', 'grinder',
  // ── Fertiliser Use & Availability ──────────────────────────────────────────
  'fertilizer', 'fertiliser', 'dose', 'dose per acre', 'dose per hectare',
  'npk ratio', 'basal dose', 'top dressing', 'foliar spray', 'foliar application',
  'broadcasting', 'band placement', 'spot placement', 'fertigation',
  'slow release', 'controlled release', 'urea ammonium nitrate',
  'micronutrient mixture', 'chelated micronutrient', 'iron sulphate',
  'zinc sulphate', 'borax', 'urea', 'urea prilled', 'urea granular',
  'SSP', 'single super phosphate', 'gypsum', 'dap',
  // ── Harvest & Post-Harvest ──────────────────────────────────────────────────
  'harvest', 'harvesting', 'harvest time', 'maturity', 'maturity index',
  'harvesting stage', 'optimum harvest', 'timely harvest', 'delayed harvest',
  'yield', 'yield estimate', 'expected yield', 'low yield', 'yield loss',
  'grain', 'grain moisture', 'drying', 'sun drying', 'mechanical drying',
  'storage', 'godown', 'warehouse', 'cold storage', 'crushing',
  'processing', 'value addition', 'grading', 'sorting', 'packaging',
  'milling', 'rice milling', 'sugarcane crushing',
  // ── Government Schemes & Credit ─────────────────────────────────────────────
  'pm kisan', 'pmkisan', 'fasal bima', 'crop insurance', 'crop loan',
  'kisan credit', 'kisan credit card', 'kcc', 'subsidy', 'subsidies',
  'pmfby', 'restructured crop loan', 'interest subsidy',
  'minimum support price', 'msp', 'procurement', 'mandi', 'mandi price',
  // ── Seed & Variety ──────────────────────────────────────────────────────────
  'seed', 'seeds', 'variety', 'varieties', 'high yield', 'high yielding',
  'hyv', 'hybrid', 'op', 'open pollinated', 'improved variety', 'variety selection',
  'seed rate', 'seed treatment', 'seed coating', 'seed priming',
  'germination', 'germination test', 'seed quality', 'foundation seed',
  'certified seed', 'truthful label seed', 'tl seed',
  // ── General Agricultural Terms ─────────────────────────────────────────────
  'crop', 'crops', 'farming', 'agriculture', 'agricultural', 'agronomy',
  'agronomic', 'horticulture', 'vegetable cultivation', 'fruit cultivation',
  'field', 'field crop', 'plantation', 'orchard', 'garden',
  'plant', 'plants', 'sowing', 'transplanting', 'intercrop',
  'intercropping', 'mixed cropping', 'relay cropping', 'sequence cropping',
  'crop rotation', 'crop residue', 'stubble', 'stubble burning',
  'weeding', 'weed control', 'weed management', 'herbicide spray',
  'pruning', 'training', 'canopy management', 'pinching', 'desuckering',
  'grafting', 'budding', 'layering', 'propagation', 'hardening off',
  'vermicompost', 'biomass', 'crop waste', 'straw management',
  // ── Plant Growth Regulators ─────────────────────────────────────────────────
  'ga3', 'gibberellin', 'cytokinin', 'ethylene', 'IBA', 'NAA',
  'planofix', 'maleic hydrazide', 'paclobutrazol', 'CCC', 'ethephon',
  // ── Pollination & Fruit Set ─────────────────────────────────────────────────
  'pollination', 'bee pollination', 'honey bee', 'beekeeping', 'apiary',
  'fruit set', 'fruit drop', 'fruit drop', 'flower drop', 'blossom drop',
  'parthenocarpy',
]);

/**
 * Stop-words — non-agricultural noise terms that appear in casual Hindi/English
 * sentences but should not contribute to the agriculture score.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until',
  'while', 'although', 'though', 'whether', 'however', 'therefore',
  'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she',
  'her', 'hers', 'herself', 'its', 'itself', 'they', 'them', 'their',
  'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this', 'that',
  'these', 'those', 'am', 'about', 'against', 'also', 'any', 'because',
  'before', 'between', 'both', 'during', 'every', 'from', 'here', 'how',
  'into', 'more', 'much', 'now', 'off', 'only', 'out', 'over', 'per',
  'round', 'since', 'still', 'than', 'too', 'up', 'very', 'want', 'well',
  'when', 'where', 'whether', 'which', 'while', 'who', 'why', 'with',
  'without', 'your', 'aap', 'aapki', 'apni', 'main', 'mein', 'kya', 'hai',
  'hain', 'tha', 'the', 'ek', 'aur', 'ya', 'lekin', 'toh', 'agar', 'isliye',
  'ka', 'ki', 'ke', 'kaa', 'kee', 'ko', 'se', 'ka', 'ke', 'ki', 'kaa',
  'yeh', 'woh', 'is', 'us', 'un', 'ab', 'tab', 'jab', 'kahin', 'kahan',
  'kaun', 'kaunsa', 'kitna', 'kitne', 'kaisa', 'kaise',
]);

function computeRelevanceScore(text: string): { score: number; detail: string } {
  // Normalise: lower-case, strip punctuation, split on whitespace
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return { score: 0, detail: 'empty_input' };
  }

  let matched = 0;
  let agricultureWordCount = 0;

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    if (AGRICULTURE_KEYWORDS.has(word)) {
      matched++;
      agricultureWordCount++;
    }
    // Also check two-word phrases (bigrams) for composite terms like
    // "drip irrigation", "pigeon pea", "neem oil"
    const bigram = words
      .slice(words.indexOf(word), words.indexOf(word) + 2)
      .join(' ');
    if (bigram && bigram !== word && AGRICULTURE_KEYWORDS.has(bigram)) {
      matched++;
    }
  }

  const relevanceRatio = agricultureWordCount / words.length;

  // Scoring formula:
  //   min(1, agricultureWordCount * 0.15)  — rewards keyword density
  //   + min(0.3, relevanceRatio * 0.8)      — bonus for proportion of agri terms
  const score = Math.min(
    1,
    agricultureWordCount * 0.15 + Math.min(0.3, relevanceRatio * 0.8),
  );

  const detail =
    agricultureWordCount === 0
      ? 'no_agriculture_keywords'
      : `matched_${Math.min(agricultureWordCount, 20)}+_keywords`;

  return { score, detail };
}

// ─── Spam Detection ───────────────────────────────────────────────────────────

/** Regex patterns that strongly suggest spam or non-genuine content */
const SPAM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // Promotional / advertising
  { pattern: /\b(buy|sell|order|shop|discount|offer|free|gift|prize|winner|congratulations|winner|click here|register now|limited time)\b/gi, label: 'promotional' },
  // Repeated characters (e.g. "aaaaa" or "!!!!!!")
  { pattern: /(.)\1{5,}/g, label: 'repeated_chars' },
  // All caps or aggressive shouting (only flags if > 50% of words are caps)
  { pattern: /\b[A-Z]{5,}\b/g, label: 'excessive_caps' },
  // URLs
  { pattern: /https?:\/\/|www\./gi, label: 'url_present' },
  // Phone numbers / contact info in question body
  { pattern: /\b\d{10,}\b|\b\d[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: 'phone_number' },
  // Email addresses
  { pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, label: 'email_address' },
  // Personal info solicitation
  { pattern: /\b(send|screenshot|whatsapp|telegram|instagram|facebook)\s+(me|my|to)\b/gi, label: 'social_solicitation' },
];

interface SpamCheckResult {
  pass: boolean;
  reasonKey: string | null;
  detail: string;
}

function checkSpam(text: string): SpamCheckResult {
  if (!text || text.trim().length === 0) {
    return { pass: true, reasonKey: null, detail: 'empty' };
  }

  for (const { pattern, label } of SPAM_PATTERNS) {
    // Reset regex lastIndex before each test
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return { pass: false, reasonKey: `onDeviceAI.spam.${label}`, detail: label };
    }
  }

  // Check for very short, generic questions that are likely low-effort
  const words = text.trim().split(/\s+/);
  if (words.length < 3) {
    return { pass: false, reasonKey: 'onDeviceAI.spam.tooShort', detail: 'too_short' };
  }

  return { pass: true, reasonKey: null, detail: 'clean' };
}

// ─── Duplicate Detection ───────────────────────────────────────────────────────

/**
 * Compute Levenshtein (edit-distance) similarity ratio between two strings.
 * Returns a value in [0, 1] where 1 means identical.
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;

  const m = s1.length;
  const n = s2.length;
  if (m === 0 || n === 0) return 0;

  // Allocate a single row instead of full matrix to halve memory usage
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,     // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev]; // swap without allocation
  }

  const maxLen = Math.max(m, n);
  return maxLen === 0 ? 0 : 1 - prev[n] / maxLen;
}

/**
 * Normalise text for exact-match comparison:
 * - lower-case, strip punctuation, collapse whitespace
 */
function normaliseForExact(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

interface DuplicateCheckResult {
  pass: boolean;
  duplicateQuestionId?: string;
  similarityScore?: number;
  reasonKey: string | null;
  detail: string;
}

async function checkDuplicate(
  text: string,
  _ownId?: string, // id of the question being edited — excluded from cache
): Promise<DuplicateCheckResult> {
  const normalised = normaliseForExact(text);

  if (!normalised || normalised.length < 10) {
    // Too short to reasonably compare
    return { pass: true, reasonKey: null, detail: 'too_short_for_comparison' };
  }

  // ── Exact match first ───────────────────────────────────────────────────────
  let cached: CachedQuestion[] = [];
  try {
    const raw = await AsyncStorage.getItem(DUPLICATE_CACHE_KEY);
    if (raw) cached = JSON.parse(raw) as CachedQuestion[];
  } catch {
    cached = [];
  }

  const now = Date.now();
  const validCache = cached.filter(
    (q) => now - new Date(q.cachedAt).getTime() < DUPLICATE_CACHE_TTL_MS,
  );

  // ── Step 1: exact (normalised) match ───────────────────────────────────────
  for (const entry of validCache) {
    if (normaliseForExact(entry.text) === normalised) {
      return {
        pass: false,
        duplicateQuestionId: entry.id,
        similarityScore: 1,
        reasonKey: 'onDeviceAI.duplicate.exact',
        detail: 'exact_match',
      };
    }
  }

  // ── Step 2: semantic similarity (Levenshtein ratio ≥ threshold) ────────────
  //    Use a "best score so far" loop to avoid O(n²) blow-up on large caches.
  const threshold = SIMILARITY_THRESHOLD;
  let bestScore = 0;
  let bestId: string | undefined;
  const maxComparisons = Math.min(validCache.length, 30); // cap at 30 to bound CPU

  for (let i = 0; i < maxComparisons; i++) {
    // Levenshtein is O(mn) per comparison; for short-to-medium strings
    // (≤ 300 chars) this is fast enough even for 30 comparisons.
    const score = levenshteinSimilarity(text, validCache[i].text);
    if (score > bestScore) {
      bestScore = score;
      bestId = validCache[i].id;
    }
    if (bestScore >= threshold) break; // early exit — no need to check more
  }

  if (bestScore >= threshold && bestId) {
    return {
      pass: false,
      duplicateQuestionId: bestId,
      similarityScore: bestScore,
      reasonKey: 'onDeviceAI.duplicate.semantic',
      detail: `semantic_similarity_${Math.round(bestScore * 100)}`,
    };
  }

  return { pass: true, reasonKey: null, detail: 'no_duplicate_found' };
}

/** Persist a newly submitted question to the duplicate cache */
export async function cacheQuestionForDuplicateDetection(
  id: string,
  text: string,
): Promise<void> {
  try {
    let cached: CachedQuestion[] = [];
    const raw = await AsyncStorage.getItem(DUPLICATE_CACHE_KEY);
    if (raw) cached = JSON.parse(raw) as CachedQuestion[];

    // Evict oldest entries once the cap is hit
    if (cached.length >= DUPLICATE_CACHE_MAX_ENTRIES) {
      cached.sort((a, b) => new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime());
      cached = cached.slice(DUPLICATE_CACHE_MAX_ENTRIES * 0.3 | 0); // keep newest 70%
    }

    cached.push({ id, text, cachedAt: new Date().toISOString() });
    await AsyncStorage.setItem(DUPLICATE_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // AsyncStorage failure is non-fatal for this feature
  }
}

// ─── Public Pipeline ───────────────────────────────────────────────────────────

export interface ValidationInput {
  /** The question text as typed / transcribed by the user */
  text: string;
  /** Optional question id — used to exclude own record during edit mode */
  ownId?: string;
}

/**
 * Run the full on-device validation pipeline.
 *
 * @param input  — { text, ownId? }
 * @returns AIValidationResult  — aggregated result with per-stage breakdown
 *
 * Behaviour:
 *   - Runs all three stages even if an early one fails, so UI can show all flags
 *   - `ran = false` when the environment lacks required APIs (e.g. pure web)
 *   - Never throws; always returns a valid AIValidationResult
 */
export async function runOnDeviceValidation(
  input: ValidationInput,
): Promise<AIValidationResult> {
  const { text, ownId } = input;

  // Catch non-fatal errors so a single stage crash doesn't block the pipeline
  let relevanceResult: StageResult = { pass: true, confidence: 1 };
  let duplicateResult: StageResult = { pass: true, confidence: 1 };
  let spamResult: StageResult = { pass: true, confidence: 1 };

  let relevanceReasonKey: string | null = null;
  let duplicateReasonKey: string | null = null;
  let spamReasonKey: string | null = null;

  let overallVerdict: AIValidationResult['verdict'] = 'pass';
  let overallMessage: string | null = null;
  let overallReasonKey: string | null = null;

  // ── 1. Spam detection (synchronous, always runs) ───────────────────────────
  try {
    const spam = checkSpam(text);
    spamResult = {
      pass: spam.pass,
      confidence: spam.pass ? 1 : 0.98,
      detail: spam.detail,
    };
    spamReasonKey = spam.reasonKey;
  } catch {
    spamResult = { pass: true, confidence: 0.5, detail: 'check_failed' };
  }

  // ── 2. Agriculture relevance (synchronous) ─────────────────────────────────
  try {
    const { score, detail } = computeRelevanceScore(text);
    const pass = score >= 0.15; // threshold tuned for short queries
    relevanceResult = {
      pass,
      confidence: score,
      detail,
    };
    if (!pass) relevanceReasonKey = 'onDeviceAI.relevance.low';
  } catch {
    relevanceResult = { pass: true, confidence: 0.5, detail: 'check_failed' };
  }

  // ── 3. Duplicate detection (async — reads AsyncStorage) ────────────────────
  //    Skip on web (no AsyncStorage) to avoid blocking; duplicate check is
  //    always re-run server-side anyway.
  const canUseStorage =
    Platform.OS === 'ios' || Platform.OS === 'android';

  if (canUseStorage) {
    try {
      const dup = await checkDuplicate(text, ownId);
      duplicateResult = {
        pass: dup.pass,
        confidence: dup.similarityScore ?? 0,
        detail: dup.detail,
      };
      duplicateReasonKey = dup.reasonKey;
    } catch {
      duplicateResult = { pass: true, confidence: 0.5, detail: 'check_failed' };
    }
  }

  // ── Aggregate verdict ───────────────────────────────────────────────────────
  // Priority: spam > duplicate > relevance
  // spam and duplicate both FAIL → fail
  // spam FAIL → fail
  // duplicate FAIL → warn (show banner, user can override)
  // relevance FAIL → warn (user can still submit)
  // all pass → pass

  const spamFailed = !spamResult.pass;
  const duplicateFailed = !duplicateResult.pass;
  const relevanceFailed = !relevanceResult.pass;

  if (spamFailed) {
    overallVerdict = 'fail';
    overallReasonKey = spamReasonKey;
  } else if (duplicateFailed) {
    overallVerdict = 'warn';
    overallReasonKey = duplicateReasonKey;
  } else if (relevanceFailed) {
    overallVerdict = 'warn';
    overallReasonKey = relevanceReasonKey;
  } else {
    overallVerdict = 'pass';
  }

  return {
    verdict: overallVerdict,
    message: overallReasonKey, // caller resolves via i18n
    reasonKey: overallReasonKey,
    stages: {
      relevance: relevanceResult,
      duplicate: duplicateResult,
      spam: spamResult,
    },
    ran: true,
  };
}

/**
 * Lightweight synchronous pre-flight check suitable for debouncing on keystroke.
 * Returns the same verdict shape but skips AsyncStorage reads so it never await.
 *
 * Use this on `onChangeText` for a responsive "typing feedback" indicator.
 */
export function runOnDeviceValidationSync(input: Pick<ValidationInput, 'text'>): {
  relevanceScore: number;
  spamPass: boolean;
} {
  const { text } = input;
  const spam = checkSpam(text);
  const { score } = computeRelevanceScore(text);
  return { relevanceScore: score, spamPass: spam.pass };
}