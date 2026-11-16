/**
 * onDeviceAI.ts — On-Device AI Validation Pipeline (Web)
 *
 * Runs locally in the browser before submission to flag spam, off-topic
 * (non-agriculture) content, and near-duplicates. This is the web counterpart
 * of `mobile/src/utils/onDeviceAI.ts` — same pipeline, same verdict semantics,
 * same reasons. The only differences are:
 *
 *   - Storage uses `localStorage` instead of `AsyncStorage`
 *   - Pure browser APIs only (no React Native, no expo modules)
 *
 * Pipeline:
 *   1. Spam detection    — pattern-based (URLs, all-caps, repeated chars,
 *                          contact-info patterns)
 *   2. Relevance check   — keyword + signal scoring against an
 *                          agriculture lexicon (≥3 hits to pass)
 *   3. Duplicate check   — exact (normalised) + Levenshtein ratio against a
 *                          local question cache persisted in localStorage
 *                          with TTL eviction
 *
 * Each stage emits a `StageResult`; the pipeline aggregates them into a
 * single `AIValidationResult` with a verdict that drives the inline banner
 * and submit gating on the Ask-Question page.
 */

// ─── Constants (mirrors mobile/src/utils/constants.ts where applicable) ──────

/** Threshold above which two questions are considered duplicates (0..1). */
export const SIMILARITY_THRESHOLD = 0.82

/** Fallback char cap when backend stats don't supply one. */
export const MAX_QUESTION_CHARS_FALLBACK = 500

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AIValidationResult {
  /** Overall PASS / WARN / FAIL. WARN ⇒ show banner, FAIL ⇒ block submit. */
  verdict: 'pass' | 'warn' | 'fail'
  /** Human-readable message suitable for a toast / banner. */
  message: string | null
  /** Reason key — kept for parity with mobile (currently unused on web,
   *  but consumers may translate this later when web grows i18n). */
  reasonKey: string | null
  /** Individual stage outcomes. */
  stages: {
    relevance: StageResult
    duplicate: StageResult
    spam: StageResult
  }
  /** True when at least one stage ran; false = pipeline skipped (e.g. very
   *  short input). */
  ran: boolean
}

export interface StageResult {
  pass: boolean
  /** Confidence in 0..1. */
  confidence: number
  /** Optional short description for debug. */
  detail?: string
  /**
   * Optional reason key for i18n / per-stage message override. Mirrors the
   * `reasonKey` field on mobile (`mobile/src/utils/onDeviceAI.ts`). When the
   * aggregator promotes a failed stage to the top-level verdict, it consults
   * this key to pick a specific user-facing message (e.g. `spam.tooShort`).
   */
  reasonKey?: string
}

interface CachedQuestion {
  id: string
  text: string
  /** ISO date string — used for TTL eviction. */
  cachedAt: string
}

// ─── Storage keys / cache config ──────────────────────────────────────────────

const DUPLICATE_CACHE_KEY = 'web_on_device_ai_duplicate_cache'
const DUPLICATE_CACHE_MAX_ENTRIES = 50
const /** ms */ DUPLICATE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000 // 7 days

// ─── Agriculture Keyword Lexicon ──────────────────────────────────────────────
//
// Curated representative subset of `mobile/src/utils/onDeviceAI.ts`. Source
// for full list: mobile/src/utils/onDeviceAI.ts (AGRICULTURE_KEYWORDS set).
// Categories covered: crops (cereals, pulses, oilseeds, fibres, vegetables,
// fruits, spices, plantation, fodder), fertilizers, pesticides, irrigation,
// soil, farming practices, equipment, animal husbandry, post-harvest, common
// government schemes & policy terms. Add to this list freely to widen the
// relevance net — lookup is O(1) via the Set below.

const AGRICULTURE_KEYWORDS = new Set<string>([
  // ── Cereals & millets ──────────────────────────────────────────────────────
  'wheat', 'rice', 'paddy', 'maize', 'corn', 'bajra', 'pearl millet',
  'jowar', 'sorghum', 'ragi', 'finger millet', 'barley', 'oats',
  'foxtail millet', 'barnyard millet', 'kodo millet', 'little millet',
  'proso millet', 'brown top millet',
  // ── Pulses ────────────────────────────────────────────────────────────────
  'pulse', 'pulses', 'dal', 'gram', 'chickpea', 'chana', 'tur', 'arhar',
  'pigeonpea', 'moong', 'green gram', 'urad', 'black gram', 'masoor',
  'lentil', 'horsegram', 'horse gram', 'khesari', 'cowpea', 'field pea',
  'peas', 'beans',
  // ── Oilseeds ──────────────────────────────────────────────────────────────
  'oilseed', 'oilseeds', 'mustard', 'groundnut', 'peanut', 'soybean',
  'sunflower', 'sesame', 'til', 'castor', 'linseed', 'niger', 'safflower',
  'rapeseed', 'canola',
  // ── Cash / fibre crops ────────────────────────────────────────────────────
  'cotton', 'sugarcane', 'jute', 'flax',
  // ── Vegetables ────────────────────────────────────────────────────────────
  'vegetable', 'tomato', 'potato', 'onion', 'garlic', 'brinjal', 'eggplant',
  'okra', 'ladies finger', 'bhindi', 'cucumber', 'pumpkin', 'gourd',
  'bitter gourd', 'bottle gourd', 'ridge gourd', 'snake gourd', 'ash gourd',
  'cabbage', 'cauliflower', 'broccoli', 'carrot', 'radish', 'beetroot',
  'turnip', 'spinach', 'palak', 'fenugreek', 'methi', 'coriander', 'mint',
  'lettuce', 'capsicum', 'pepper', 'chilli', 'chili', 'green chilli',
  'drumstick', 'moringa', 'amaranth', 'amaranthus', 'arbi', 'colocasia',
  'taro', 'yam', 'sweet potato', 'tapioca', 'cassava',
  // ── Fruits ────────────────────────────────────────────────────────────────
  'fruit', 'mango', 'banana', 'apple', 'grapes', 'guava', 'papaya',
  'pomegranate', 'orange', 'lemon', 'lime', 'citrus', 'mosambi',
  'pineapple', 'watermelon', 'muskmelon', 'coconut', 'cashew', 'arecanut',
  'betel nut', 'date', 'dates', 'fig', 'kiwi', 'dragon fruit', 'avocado',
  'strawberry', 'blueberry', 'jackfruit', 'custard apple', 'sitafal',
  'sapota', 'chikoo', 'ber', 'jujube', 'bael', 'wood apple', 'aonla',
  'amla', 'gooseberry', 'tamarind', 'imli', 'litchi', 'lychee', 'jamun',
  'java plum', 'phalsa', 'karonda',
  // ── Spices & condiments ───────────────────────────────────────────────────
  'spice', 'spices', 'turmeric', 'haldi', 'ginger', 'adrak', 'black pepper',
  'pepper', 'cardamom', 'elaichi', 'cinnamon', 'dalchini', 'clove', 'laung',
  'cumin', 'jeera', 'coriander', 'dhania', 'fennel', 'saunf', 'fenugreek',
  'methi', 'ajwain', 'carom', 'mustard seed', 'asafoetida', 'hing',
  'red chilli', 'kashmiri mirch', 'nutmeg', 'jaiphal', 'mace', 'javitri',
  'saffron', 'kesar', 'star anise', 'chakra phool',
  // ── Plantation & commercial crops ─────────────────────────────────────────
  'tea', 'coffee', 'rubber', 'cocoa', 'coconut', 'arecanut', 'cashew',
  'oil palm', 'palm oil', 'olive',
  // ── Fodder & forage ───────────────────────────────────────────────────────
  'fodder', 'forage', 'napier', 'hybrid napier', 'guinea grass',
  'para grass', 'rhodes grass', 'bermuda grass', 'pangola grass',
  'congosignal grass', 'setaria', 'fodder maize', 'fodder sorghum',
  'fodder cowpea', 'berseem', 'lucerne', 'alfalfa', 'hedge lucerne',
  'stylo', 'gliricidia', 'subabul',
  // ── Fertilizers & nutrients ────────────────────────────────────────────────
  'fertilizer', 'fertiliser', 'urea', 'dap', 'mop', 'ssp', 'tsp',
  'nitrogen', 'phosphorus', 'potassium', 'npk', 'zn', 'zinc',
  'boron', 'iron', 'sulphur', 'gypsum', 'dolomite', 'limestone',
  'vermicompost', 'compost', 'fym', 'farmyard manure', 'green manure',
  'biofertilizer', 'azotobacter', 'azospirillum', 'rhizobium', 'psb',
  'phosphate solubilizing bacteria', 'potash mobilizing bacteria',
  'mycorrhiza', 'amc', 'amc fungi', 'inoculant',
  // ── Pesticides (broad categories + common examples) ───────────────────────
  'pesticide', 'pesticides', 'insecticide', 'insecticides', 'fungicide',
  'fungicides', 'herbicide', 'herbicides', 'nematicide', 'pest',
  'pests', 'aphid', 'aphids', 'thrips', 'whitefly', 'white fly',
  'leafhopper', 'stem borer', 'fruit borer', 'pod borer', 'bollworm',
  'armyworm', 'cutworm', 'termite', 'termites', 'mite', 'mites',
  'imidacloprid', 'thiamethoxam', 'acetamiprid', 'chlorpyriphos',
  'monocrotophos', 'endosulfan', 'mancozeb', 'copper oxychloride',
  'coc', 'carbendazim', 'trichoderma', 'neem oil', 'azadirachtin',
  'biopesticide', 'pheromone trap', 'light trap', 'yellow sticky trap',
  'sticky trap', 'pest control', 'disease control',
  // ── Irrigation & water management ──────────────────────────────────────────
  'irrigation', 'drip', 'drip irrigation', 'sprinkler', 'sprinkler irrigation',
  'micro irrigation', 'rainfed', 'rain fed', 'flood irrigation', 'furrow',
  'border strip', 'check basin', 'pivot', 'central pivot', 'rain gun',
  'pump', 'pumpset', 'submersible', 'borewell', 'open well', 'canal',
  'water management', 'mulching', 'mulch', 'plastic mulch', 'drainage',
  'water harvesting', 'farm pond', 'watershed', 'micro watershed',
  // ── Soil ──────────────────────────────────────────────────────────────────
  'soil', 'sandy', 'loam', 'loamy', 'clay', 'clayey', 'alluvial', 'black soil',
  'red soil', 'laterite', 'saline', 'sodic', 'alkaline', 'acidic',
  'ph', 'ec', 'electrical conductivity', 'organic carbon', 'soil health',
  'soil health card', 'soil testing', 'soil test', 'soil organic matter',
  'earthworm', 'soil microbiome', 'mycorrhiza', 'nitrogen fixation',
  'nodulation', 'rhizosphere',
  // ── Farming practices ─────────────────────────────────────────────────────
  'sowing', 'planting', 'transplanting', 'harvest', 'harvesting', 'threshing',
  'grow', 'growing', 'cultivate', 'cultivating', 'raise', 'raising',
  'winnowing', 'drying', 'storage', 'warehousing', 'grain storage',
  'seed', 'seeds', 'seedling', 'germination', 'nursery', 'planting material',
  'hybrid', 'variety', 'heirloom', 'landrace', 'cultivar', 'gene',
  'grafting', 'budding', 'layering', 'cutting', 'propagation',
  'pruning', 'training', 'trellising', 'staking', 'weeding', 'hoeing',
  'earthing up', 'top dressing', 'foliar spray', 'fertigation',
  'crop rotation', 'intercropping', 'mixed cropping', 'relay cropping',
  'monoculture', 'polyculture', 'cover crop', 'green manure crop',
  'zero tillage', 'no till', 'minimum tillage', 'conservation agriculture',
  'precision farming', 'hydroponics', 'aeroponics', 'vertical farming',
  'greenhouse', 'polyhouse', 'nethouse', 'shade net',
  // ── Equipment & mechanisation ─────────────────────────────────────────────
  'tractor', 'plough', 'plow', 'harrow', 'cultivator', 'rotavator',
  'seed drill', 'planter', 'transplanter', 'harvester', 'combine',
  'combine harvester', 'thresher', 'power tiller', 'weeder',
  'sprayer', 'knapsack', 'power sprayer', 'duster', 'trolley',
  'transport', 'farm machinery', 'mechanization', 'mechanisation',
  'custom hiring centre', 'chc', 'farmer producer organisation', 'fpo',
  // ── Animal husbandry & dairy ───────────────────────────────────────────────
  'livestock', 'cattle', 'cow', 'buffalo', 'ox', 'bullock', 'goat',
  'sheep', 'pig', 'poultry', 'chicken', 'hen', 'broiler', 'layer',
  'duck', 'duckling', 'turkey', 'quail', 'rabbit', 'beekeeping',
  'honey bee', 'apiculture', 'sericulture', 'silk', 'mulberry',
  'fisheries', 'fish', 'prawn', 'shrimp', 'aquaculture', 'pisciculture',
  'flock', 'breed', 'crossbreed', 'crossbred', 'tharparkar', 'gir',
  'sahiwal', 'murrah', 'hf', 'jersey', 'holstein friesian',
  'milking', 'milk', 'dairy', 'paneer', 'ghee', 'curd', 'khoya',
  'vaccination', 'deworming', 'anthrax', 'fmd', 'haemorrhagic',
  'mastitis', 'ppr', 'ranikhet', 'gumboro', 'coccidiosis',
  // ── Post-harvest & processing ──────────────────────────────────────────────
  'post harvest', 'post-harvest', 'cold storage', 'cold chain',
  'refrigeration', 'pack house', 'sorting', 'grading', 'ripening',
  'ripener', 'ethylene', 'dehydration', 'drying', 'solar dryer',
  'canning', 'pickle', 'jam', 'jelly', 'marmalade', 'juice',
  'squash', 'syrup', 'sauce', 'ketchup', 'milling', 'dehusking',
  'dehulling', 'polishing', 'parboiling',
  // ── Government schemes & policy ───────────────────────────────────────────
  'pm kisan', 'pmkisan', 'pm-kisan', 'kisan samman', 'samman nidhi',
  'pmfby', 'fasal bima', 'crop insurance', 'kcc', 'kisan credit card',
  'kisan credit', 'crop loan', 'interest subsidy', 'msp',
  'minimum support price', 'procurement', 'mandi', 'mandi price',
  'apmc', 'e-nam', 'enam', 'rkvy', 'rashtriya krishi vikas yojana',
  'nfsm', 'national food security mission', 'nhm', 'national horticulture mission',
  'pkvy', 'paramparagat krishi', 'shm', 'soil health management',
  'smam', 'sub mission agricultural mechanization', 'nmoop',
  'nmsa', 'national mission sustainable agriculture',
  'midh', 'mission for integrated development of horticulture',
  'fpo', 'farmer producer organisation', 'pacs', 'primary agricultural credit society',
  'agmark', 'fssai', 'haccp', 'gmp', 'iso 22000', 'bis standards',
  'jaivik', 'pgs', 'participatory guarantee system', 'organic certification',
  'extension', 'kvk', 'krishi vigyan kendra', 'ati', 'agriclinic',
  'agribusiness', 'subsidy', 'subsidies', 'grant', 'tariff',
  'crop diversification', 'doubling farmer income',
  'natural farming', 'organic farming', 'zero budget natural farming',
  'zbnf', 'agroforestry',
  // ── Markets & finance ─────────────────────────────────────────────────────
  'market', 'price', 'mandi rate', 'wholesale', 'retail', 'commodity',
  'futures', 'spot price', 'export', 'import', 'phytosanitary',
  'apeda', 'mpeda', 'tea board', 'coffee board', 'spices board',
  'cooperative', 'nabard', 'nabard refinance', 'rbi', 'loan waiver',
  'crop loan', 'term loan', 'gold loan', 'kcc limit',
  'income', 'profit', 'loss', 'cost of cultivation', 'cost of production',
  'msamb', 'agmarknet',
  // ── Climate & stress ──────────────────────────────────────────────────────
  'rainfall', 'monsoon', 'drought', 'flood', 'floods', 'cyclone',
  'cyclones', 'heat wave', 'cold wave', 'frost', 'hailstorm',
  'climate', 'climate change', 'weather', 'imd', 'india meteorological',
  'met department', 'forecast', 'agromet advisory', 'agromet',
  'stress', 'abiotic stress', 'biotic stress', 'waterlogging',
  'evapotranspiration', 'et0', 'reference crop evapotranspiration',
  'kharif', 'rabi', 'zaid', 'pre-kharif', 'post-kharif', 'monsoon season',
  'water stress', 'heat stress', 'cold stress',
  // ── Tools / domains of the form ────────────────────────────────────────────
  'crop', 'crops', 'farm', 'farmer', 'farming', 'agriculture',
  'agricultural', 'agrarian', 'cultivation', 'harvest', 'yield',
  'acre', 'hectare', 'bigha', 'gunta', 'kanal', 'biswa', 'marla',
  'season', 'weather', 'soil', 'plant', 'crop yield', 'production',
  'productivity', 'kisan', 'kisaan', 'khet', 'kheti', 'fasal',
  'fasal chetavani', 'fasal suraksha', 'fasal bima',
  'input', 'inputs', 'output', 'cost', 'rates',
  // ── Common Indian-language transliterations (subset) ──────────────────────
  // Helps with code-switched text like "meri gehun ki fasal mein keede lag gaye".
  // The full mobile list has 4000+ such terms; we keep a representative subset.
  'fasal', 'fasal mein', 'fasal ki', 'khet', 'khet ki', 'khet mein',
  'keede', 'keeda', 'keet', 'keetnashi', 'keetnashak',
  'rog', 'rog niyantran', 'kumharanashak',
  'sinchai', 'sinchai vyavastha', 'paani', 'jal', 'jal sansadhan',
  'khaad', 'khad', 'urvarak', 'dawai', 'dava',
  'beej', 'beej upachar', 'nursery', 'kisan', 'kisaan',
  'kapas', 'kapas ki kheti', 'kapaas', 'dhan', 'dhan ki kheti',
  'gehun', 'gahu', 'makka', 'makai', 'arhar ki daal', 'moong ki daal',
  'tamatar', 'aloo', 'pyaz', 'lehsun', 'adrak', 'nimbu', 'nimbu pani',
  'amla', 'aam', 'kela', 'seb', 'angoor', 'narangi', 'santara',
  'gaay', 'gai', 'bhains', 'bakri', 'bhed', 'murgi', 'machhli',
])

// ─── Stop-words (English) ──────────────────────────────────────────────────────
//
// Non-agricultural noise terms that appear in casual questions ("Can I grow
// wheat in Delhi this month?") but should not contribute to the agriculture
// relevance score. Mirrors the English subset of mobile/src/utils/onDeviceAI.ts
// STOP_WORDS so behaviour stays in sync across platforms.
//
// Keeping this English-only is deliberate: the lexicon already covers the
// common transliterated Hindi / regional agriculture terms, and excluding
// only high-frequency function words is enough to fix the
// "single-keyword-on-long-question" false positive without losing recall on
// legitimate non-English inputs.
const STOP_WORDS = new Set<string>([
  // Articles & determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'each', 'every',
  'either', 'neither', 'both', 'all', 'any', 'some', 'few', 'many', 'much',
  'more', 'most', 'less', 'least', 'other', 'another', 'such', 'own', 'same',
  'no', 'enough', 'several', 'certain', 'whole', 'half',
  // Pronouns
  'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'what', 'which', 'who', 'whom', 'whose', 'one', 'ones',
  // Auxiliary & modal verbs
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'done', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might',
  'must', 'need', 'dare', 'ought', 'used',
  'get', 'got', 'gotten', 'getting',
  'let', 'lets', 'make', 'makes', 'made',
  'go', 'goes', 'went', 'come', 'comes', 'came',
  'say', 'said', 'says',
  'tell', 'told', 'tells',
  'know', 'knew', 'knows',
  'think', 'thought', 'thinks',
  'see', 'saw', 'seen',
  'look', 'looked', 'looks',
  'want', 'wanted', 'wants',
  'like', 'liked', 'likes',
  // Prepositions
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'under', 'over', 'up', 'down', 'out', 'off', 'about', 'against',
  'along', 'among', 'around', 'behind',
  // Common adverbs / misc
  'here', 'there', 'now', 'then', 'today', 'tomorrow', 'yesterday',
  'when', 'where', 'why', 'how',
  'so', 'very', 'too', 'just', 'also', 'still', 'even', 'only',
  'yes', 'not', 'ok', 'okay', 'please',
])

// ─── Spam patterns ────────────────────────────────────────────────────────────

const SPAM_URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/i
const SPAM_EMAIL_PATTERN = /[\w.-]+@[\w-]+\.[\w.-]+/

function isLikelySpam(text: string): StageResult {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { pass: true, confidence: 1 }

  if (SPAM_URL_PATTERN.test(trimmed) || SPAM_EMAIL_PATTERN.test(trimmed)) {
    return {
      pass: false,
      confidence: 0.95,
      detail: 'Contains URL or email address.',
      reasonKey: 'onDeviceAI.spam.contactInfo',
    }
  }

  // Long unbroken digit runs (e.g. 1234567890123) — likely phone numbers
  const digitRun = trimmed.match(/\d{8,}/)
  if (digitRun) {
    return {
      pass: false,
      confidence: 0.85,
      detail: 'Contains long numeric sequence.',
      reasonKey: 'onDeviceAI.spam.contactInfo',
    }
  }

  // Question is too short to be substantive. Mirrors mobile `checkSpam`'s
  // `< 3 words` rule (`mobile/src/utils/onDeviceAI.ts`). This is what produces
  // the "Your question is too short. Please describe your agriculture
  // question in more detail." banner on mobile, and on web via
  // `runOnDeviceValidation`'s aggregation.
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount < 3) {
    return {
      pass: false,
      confidence: 0.85,
      detail: 'Question is too short.',
      reasonKey: 'onDeviceAI.spam.tooShort',
    }
  }

  // Repeated character spam e.g. "aaaaaaaaa"
  if (/(.)\1{6,}/.test(trimmed)) {
    return {
      pass: false,
      confidence: 0.9,
      detail: 'Repeated characters.',
      reasonKey: 'onDeviceAI.spam.repeatedChars',
    }
  }

  // Mostly-uppercase ranting
  const letters = trimmed.replace(/[^a-zA-Z]/g, '')
  if (letters.length >= 20 && letters === letters.toUpperCase()) {
    return {
      pass: false,
      confidence: 0.7,
      detail: 'All-uppercase.',
      reasonKey: 'onDeviceAI.spam.allCaps',
    }
  }

  return { pass: true, confidence: 0.95 }
}

// ─── Agriculture relevance ────────────────────────────────────────────────────

/**
 * Counts the number of agriculture-keyword hits in the question text.
 * Phrase-aware: multi-word needles (e.g. "drip irrigation", "minimum support
 * price") consume consecutive tokens so single-word matches underneath them
 * aren't double-counted.
 */
function checkRelevance(text: string): StageResult {
  const normalised = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining marks
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalised) return { pass: false, confidence: 0, detail: 'Empty input.' }

  // Drop English stop-words so they don't dilute keyword density. This also
  // prevents long casual questions like "Can I grow wheat in Delhi this month?"
  // from being flagged as off-topic just because only one true agri keyword
  // (e.g. "wheat") survives the noise.
  const tokens = normalised
    .split(' ')
    .filter((t) => t && !STOP_WORDS.has(t))
  if (tokens.length === 0) {
    return { pass: false, confidence: 0, detail: 'Only stopwords.' }
  }
  const multiWordNeedles: string[] = []
  for (const kw of AGRICULTURE_KEYWORDS) {
    if (kw.includes(' ')) multiWordNeedles.push(kw)
  }

  let hits = 0
  const used = new Array(tokens.length).fill(false)
  // Phrase matches consume words, so scan token-by-token and skip matched range.
  for (const phrase of multiWordNeedles) {
    const phraseTokens = phrase.split(' ')
    outer: for (let i = 0; i <= tokens.length - phraseTokens.length; i++) {
      if (used[i]) continue
      for (let j = 0; j < phraseTokens.length; j++) {
        if (used[i + j] || tokens[i + j] !== phraseTokens[j]) continue outer
      }
      hits += phraseTokens.length
      for (let j = 0; j < phraseTokens.length; j++) used[i + j] = true
    }
  }
  // Single-word matches
  for (let i = 0; i < tokens.length; i++) {
    if (used[i]) continue
    if (AGRICULTURE_KEYWORDS.has(tokens[i])) {
      hits++
      used[i] = true
    }
  }

  // Mobile-aligned scoring (mirrors mobile/src/utils/onDeviceAI.ts
  // computeRelevanceScore):
  //   score = min(1, hits * 0.15 + min(0.3, ratio * 0.8))
  //   pass  = score >= 0.15
  // The 0.15 threshold is intentionally low so a single strong signal word
  // (e.g. "wheat") on a 3-5 word question still passes; the ratio term
  // prevents false positives on long off-topic queries.
  const len = tokens.length
  const ratio = len === 0 ? 0 : hits / len
  const score = Math.min(1, hits * 0.15 + Math.min(0.3, ratio * 0.8))
  const pass = score >= 0.15

  return {
    pass,
    confidence: Math.max(0, Math.min(1, score)),
    detail: pass
      ? `Relevant (${hits} keywords, ${(ratio * 100).toFixed(0)}%)`
      : `Off-topic (${hits} keywords, ${(ratio * 100).toFixed(0)}%)`,
  }

}


// ─── Duplicate detection via Levenshtein ─────────────────────────────────────

/** Levenshtein distance between two strings (iterative O(n*m)). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const prev = new Array(n + 1)
  const curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    const ai = a.charCodeAt(i - 1)
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

/** Similarity ratio (0..1) — 1 means identical. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const dist = levenshtein(a, b)
  const maxLen = Math.max(a.length, b.length)
  return maxLen === 0 ? 0 : 1 - dist / maxLen
}

/** Whitespace + diacritics + case-folded comparison string. */
export function normaliseForCompare(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── localStorage cache ───────────────────────────────────────────────────────

function readCache(): CachedQuestion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DUPLICATE_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CachedQuestion[]
    if (!Array.isArray(parsed)) return []
    // Filter out expired entries on read
    const cutoff = Date.now() - DUPLICATE_CACHE_TTL_MS
    return parsed.filter((q) => {
      const t = new Date(q.cachedAt).getTime()
      return Number.isFinite(t) && t > cutoff
    })
  } catch {
    return []
  }
}

function writeCache(entries: CachedQuestion[]): void {
  if (typeof window === 'undefined') return
  try {
    // Bound size to most-recent N entries
    const trimmed = entries
      .sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime())
      .slice(0, DUPLICATE_CACHE_MAX_ENTRIES)
    window.localStorage.setItem(DUPLICATE_CACHE_KEY, JSON.stringify(trimmed))
  } catch {
    /* quota or privacy-mode — silently fail */
  }
}

/**
 * Append a new question to the duplicate-detection cache. Called after a
 * successful submission so future drafts get checked against it.
 *
 * @param text The final, submitted question text.
 * @param id   Optional stable id; defaults to a timestamp.
 */
export function cacheQuestionForDuplicateDetection(text: string, id?: string): void {
  const clean = text.trim()
  if (!clean) return
  const entry: CachedQuestion = {
    id: id ?? `q-${Date.now()}`,
    text: clean,
    cachedAt: new Date().toISOString(),
  }
  const existing = readCache()
  const normNew = normaliseForCompare(clean)
  // De-dupe against exact-normalised matches
  const filtered = existing.filter((q) => normaliseForCompare(q.text) !== normNew)
  filtered.push(entry)
  writeCache(filtered)
}

function checkDuplicate(text: string): StageResult {
  const cleaned = text.trim()
  if (cleaned.length < 12) {
    // Too short to meaningfully compare.
    return { pass: true, confidence: 0.5 }
  }
  const target = normaliseForCompare(cleaned)
  const cache = readCache()
  let best = 0
  for (const q of cache) {
    const sim = similarity(target, normaliseForCompare(q.text))
    if (sim > best) best = sim
    if (best > 0.98) break // close enough — skip the rest
  }
  const isDuplicate = best >= SIMILARITY_THRESHOLD
  return {
    pass: !isDuplicate,
    confidence: Math.max(0, Math.min(1, best)),
    detail: isDuplicate ? `Duplicate (${(best * 100).toFixed(0)}%)` : 'Unique',
  }
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Run the full on-device validation pipeline against user-typed text.
 * Aggregation rules (mirrored from `mobile/src/utils/onDeviceAI.ts`):
 *
 *   • Empty input → skip and return `ran: false` (no banner).
 *   • If spam (incl. the `< 3 words` "too short" rule) → verdict = 'fail'.
 *   • Else if relevance fails or duplicate → verdict = 'warn'.
 *   • Else → verdict = 'pass'.
 *
 * Note: duplicate failures are surfaced as 'warn' (not 'fail') to mirror
 * mobile behaviour — duplicates are surfaced but don't hard-block submission.
 * The server still enforces strict de-duplication on `/questions/preview`.
 */
export async function runOnDeviceValidation(text: string): Promise<AIValidationResult> {
  const cleaned = text.trim()

  // Empty input: skip the pipeline entirely so we don't flash banners on
  // focus or transient whitespace. Mirrors mobile's `checkSpam` 'empty'
  // pass-through (no banner shown).
  if (cleaned.length === 0) {
    return {
      verdict: 'pass',
      message: null,
      reasonKey: null,
      stages: {
        relevance: { pass: true, confidence: 1 },
        duplicate: { pass: true, confidence: 0 },
        spam: { pass: true, confidence: 1 },
      },
      ran: false,
    }
  }

  // Always run the full pipeline, even on short input. The spam stage now
  // handles the "< 3 words" rule (see `isLikelySpam`) and emits
  // `onDeviceAI.spam.tooShort`, which we resolve to the friendly
  // "Please describe your agriculture question in more detail." banner —
  // mirroring mobile `mobile/src/utils/onDeviceAI.ts` behaviour.
  const relevance = checkRelevance(cleaned)
  const duplicate = checkDuplicate(cleaned)
  const spam = isLikelySpam(cleaned)

  let verdict: AIValidationResult['verdict'] = 'pass'
  let message: string | null = null
  let reasonKey: string | null = null

  // Priority (mirrors mobile): spam > relevance > duplicate
  //   spam FAIL        → fail  (hard block, cannot submit)
  //   relevance FAIL   → warn  (banner shown, user may still submit)
  //   duplicate FAIL   → warn  (banner shown, user may still submit)
  if (!spam.pass) {
    verdict = 'fail'
    reasonKey = spam.reasonKey ?? 'onDeviceAI.spamDetected'
    if (reasonKey === 'onDeviceAI.spam.tooShort') {
      message =
        'Your question is too short. Please describe your agriculture question in more detail.'
    } else {
      message = 'Your question looks like spam or promotional content.'
    }
  } else if (!relevance.pass) {
    verdict = 'warn'
    message =
      'Your question may not be clearly about agriculture. Consider adding details about your crop, field, or problem.'
    reasonKey = 'onDeviceAI.notClearlyAgriculture'
  } else if (!duplicate.pass) {
    verdict = 'warn'
    message =
      'This question looks very similar to one you asked recently. To save expert time, consider rephrasing or check the existing answer.'
    reasonKey = 'onDeviceAI.duplicateDetected'
  }

  return {
    verdict,
    message,
    reasonKey,
    stages: { relevance, duplicate, spam },
    ran: true,
  }
}

/**
 * Convenience: returns the validation result only when verdict > pass.
 * Lets the UI render null when there's nothing to surface.
 */
export async function runValidationIfWorthShowing(
  text: string,
): Promise<AIValidationResult | null> {
  const r = await runOnDeviceValidation(text)
  return r.verdict === 'pass' ? null : r
}