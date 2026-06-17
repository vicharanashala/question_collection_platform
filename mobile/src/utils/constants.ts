import { UserCategory } from '../types';

// ─── API Base URL ─────────────────────────────────────────────────────────────
// In production, replace with your deployed backend URL
export const API_BASE_URL = 'http://192.168.1.5:3000/api/v1';

// ─── Indian States ─────────────────────────────────────────────────────────────

// ─── Crops ──────────────────────────────────────────────────────────────────────

export const CROPS = [
  "Adapathiyan", "Agathi", "Ailanthus or Matti", "Ajwain (Carom seeds)",
  "Allspice", "Almond", "Aloe vera", "Amaranth", "Amaranthus", "Amla",
  "Anthurium", "Apple", "Apricot", "Arecanut", "Arhar", "Arhar Dal (Red Gram)",
  "Aromatic Rice", "Arrow root", "Arum (Elephant Foot Yam)", "Arum Lobe", "Arum Stem",
  "Ash Gourd", "Ash gourd", "Ashwagandha", "Asoka", "Avocado",
  "Babool / Indian gum arabic tree", "Babool Tree", "Baby corn", "Babycorn",
  "Bajra/Pearl millet", "Bamboo", "Banana", "Banana Stem", "Barley",
  "Barnyard Millet", "Barnyard millet", "Beans", "Beet root", "Beetroot",
  "Bengal Gram", "Bengal Gram/Chickpea", "Ber", "Ber (Jujube)", "Berseem",
  "Betel Leaf", "Betel leaf", "Betel vine", "Bethua Leaves", "Beto Shak",
  "Bird of paradise", "Bitter Gourd", "Bitter gourd", "Black Cumin", "Black Gram",
  "Black Grapes", "Black Pepper", "Black gram", "Black pepper", "Blueberry",
  "Bottle Gourd", "Bottle gourd", "Brahmi", "Brinjal", "Brinjal (Eggplant)",
  "Brinjal / Eggplant", "Broad beans", "Broccoli", "Brocolli", "Brown Top Millet",
  "Buckwheat", "Butter / Mahua Tree", "Cabbage", "Camboge", "Capsicum", "Cardamom",
  "Carnation", "Carom", "Carrot", "Cashew", "Cassava (Tapioca)", "Cassia", "Castor",
  "Casuarina", "Cauliflower", "Celery", "Celery Seeds", "Ceylon Spinach",
  "Chadachi", "Char Magaz", "Chayote", "Chengazhinirkizhangu", "Chethikoduveli",
  "Chick pea", "Chickpea", "Chickpea, Bengal gram", "Chikoo", "Chilli", "Chilly",
  "China aster", "Chinese cabbage", "Chittadalotakam", "Chittaratha", "Chow Chow",
  "Chrysanthemum", "Cinnamon", "Citronella grass", "Citrus", "Clove", "Cloves",
  "Cluster bean", "Cocoa", "Coconut", "Coffee", "Coleus", "Colocacia", "Colocasia",
  "Congosignal grass", "Coriander", "Coriander (Cilantro)", "Coriander Leaves/Seeds",
  "Cotton", "Cowpea", "Crossandra", "Cucumber", "Cumin", "Cumin Seeds",
  "Curry leaves", "Custard Apple", "Custard apple",
  "Daincha", "Danthappala", "Darjeeling Orange", "Date", "Date Palm", "Date palm",
  "Davana", "Dill leaves", "Dillseed", "Dragon Fruit", "Drumstick", "Drumstick (Moringa)",
  "Elephant Apple", "Elephant Foot Yam", "Eucalyptus",
  "Fennel", "Fenugreek", "Fenugreek (Methi)", "Field pea", "Fig", "Finger Millet",
  "Finger millet", "Firecracker flower", "Fodder cowpea", "Fodder maize",
  "Fodder sorghum", "Foxtail Millet", "Foxtail millet", "French bean",
  "Gaillardia", "Galgal (Hill Lemon)", "Gamba grass", "Garlic", "Geranium", "Gerbera",
  "German Turnip", "Gherkins", "Ginger", "Gladiolus", "Gliricidia", "Gram", "Grape",
  "Grapes", "Greater yam", "Green Cardamom", "Green Chilli", "Green Gram",
  "Green Mango", "Green Papaya", "Green Peas", "Green gram", "Green gram, Golden gram",
  "Green pea", "Greeng gram", "Ground Nut", "Groundnut", "Guava", "Guinea grass",
  "Gymnema (Sugar destroyer)",
  "Hedge lucerne", "Heliconia", "Hogplum", "Holy basil", "Honey Plant", "Hops",
  "Horse Gram", "Horse gram", "Horsegram",
  "Hyacinth Bean", "Hyacinth Bean or Lablab Bean", "Hybrid napier",
  "Indian Beech / Pongam Tree", "Indian Beech Tree", "Indian Blackberry",
  "Indian Butter Tree / Mahua", "Indian Gooseberry", "Indian Gooseberry (Amla)",
  "Indian Jujube (Ber)", "Indian gooseberry",
  "Indian hogweed / Spiny amaranth", "Indian mustard",
  "Indian sarsaparilla (Mangani root)", "Indigo", "Irul", "Ivy Gourd", "Ivy gourd",
  "Jack", "Jack Fruit", "Jack fruit", "Jackfruit", "Jamun", "Jamun fruit",
  "Japanese Persimmon", "Jasmine", "Jeevakom", "Jicama", "Jute Leaves",
  "Kacholam", "Kagzi Lime", "Kalai Dal", "Kampakam", "Kanjiram", "Karinochi",
  "Karonda", "Kashi kanagile", "Kasthurimanjal", "Kattarvazha", "Kidney Bean",
  "Kidney bean", "Kidney bean/Rajama", "Kinnow (mandarin)", "Kiwifruit", "Knol-khol",
  "Kodo millet", "Kokum", "Koovalam", "Kurumthotti", "Kusuma",
  "Lady's Finger", "Large Cardamom", "Lemon", "Lemongrass", "Lentil",
  "Lesser yarm", "Lettuce", "Lime / Lemon", "Linseed", "Linseed, Flax", "Litchi",
  "Little Millet", "Little millet", "Long melon", "Long pepper", "Loquat", "Lucerne",
  "Mahagony", "Mahogany", "Maize", "Malabar Neem", "Mandarin", "Mandarin orange",
  "Mangium", "Mango", "Mango-ginger", "Mangosteen", "Marigold", "Mash",
  "Matar Dal (Split peas)", "Mentha", "Mesta", "Millet", "Moong", "Moong Dal",
  "Moth Bean", "Moth bean", "Mung", "Mung bean", "Mushroom", "Muskmelon", "Mustard",
  "Musur Dal",
  "Napier Grass", "Neela amari", "Neem", "Neem (ground type)", "Niger", "Nilappana",
  "Nutmeg",
  "Oat", "Oats", "Oilpalm", "Okra", "Okra (Lady\u2019s finger)", "Olive", "Onion",
  "Orange", "Orange (Sweet Orange / Mosambi)", "Orchids",
  "Paddy", "Paddy/Rice", "Palmarosa", "Palmarosa grass", "Palmyra palm", "Papaya",
  "Para grass", "Paradise Tree", "Passion fruit", "Patchouli", "Pathimugham", "Pea",
  "Peach", "Pear", "Pearl Millet", "Pearl millet", "Pecan Nut",
  "Physic Nut / Jatropha", "Pickling melon", "Pigeon Pea", "Pigeon pea",
  "Pigeon pea, Red gram", "Pineapple", "Plum", "Pointed Gourd", "Pomegranate",
  "Potato", "Proso millet", "Proso milllet", "Pumpkin", "Punna", "Quina",
  "Raddish", "Radish", "Ragi", "Ramboothan", "Ramphal", "Rapeseed and Mustard",
  "Raw Bengal Gram", "Red Chilli", "Red Gram/Pigeon Pea", "Red Sandalwood",
  "Red Sanders / Red Sandalwood", "Red gram", "Rice", "Rice (Paddy)", "Ridge Gourd",
  "Ridge gourd", "Ripe Papaya", "Rose", "Rose (Greenhouse)", "Roselle / Red sorrel",
  "Rosemary", "Rosewood", "Round gourd", "Rubber", "Ryegrass",
  "Safed musli", "Safflower", "Sandal", "Sandalwood", "Sapodilla (Chiku)", "Sapota",
  "Sarpagandha (Indian snakeroot)", "Senji", "Sesame", "Sesame, Gingelly", "Setaria grass",
  "Shaftal", "Shah Marich", "Shevri", "Snake Gourd", "Snake gourd", "Sorghum",
  "Sorghum (Fodder)", "Sorghum (Rabi/Kharif)", "Soyabean", "Soybean", "Spinach",
  "Sponge gourd", "Squash", "Stevia", "Strawberry", "Stylo", "Subabul", "Sugarbeet",
  "Sugarcane", "Summer squash", "Sun hemp", "Sunflower", "Sweet Cherry",
  "Sweet Lemon", "Sweet Lime", "Sweet orange", "Sweet pepper", "Sweet potato",
  "Tamarind", "Tapioca", "Tea", "Teak", "Thembavu", "Thippali", "Thorny bamboo",
  "Thulasi", "Tobacco", "Tomato", "Tree Tomato", "Tuberose", "Tulsi (Holy basil)",
  "Turmeric", "Turnip",
  "Urd",
  "Vanilla", "Vegetable cowpea", "Venga", "Vetiver", "Vetiver (Khus grass)",
  "Walnut", "Wanga", "Water melon", "Watermelon", "West Indian Cherry", "Wheat",
  "White yam", "Wild Tamarind", "Wild date palm", "Wild indigo",
  "Wild jack or Aini", "Wood apple", "Yam",
] as const;

export const CROP_OPTIONS = CROPS.map((c) => ({ value: c, label: c }));

// ─── Indian States ─────────────────────────────────────────────────────────────

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
] as const;

export type IndianState = typeof INDIAN_STATES[number];

// ─── 22 Indian Languages ───────────────────────────────────────────────────────

export const LANGUAGES = [
  { code: 'en',  label: 'English',         labelEnglish: 'English' },
  { code: 'as',  label: 'অসমীয়া',           labelEnglish: 'Assamese' },
  { code: 'bn',  label: 'বাংলা',             labelEnglish: 'Bengali' },
  { code: 'brx', label: 'बड़ो',              labelEnglish: 'Bodo' },
  { code: 'doi', label: 'डोगरी',             labelEnglish: 'Dogri' },
  { code: 'gu',  label: 'ગુજરાતી',           labelEnglish: 'Gujarati' },
  { code: 'hi',  label: 'हिन्दी',             labelEnglish: 'Hindi' },
  { code: 'kn',  label: 'ಕನ್ನಡ',              labelEnglish: 'Kannada' },
  { code: 'ks',  label: 'कश्मीरी',            labelEnglish: 'Kashmiri' },
  { code: 'kok', label: 'कोंकणी',             labelEnglish: 'Konkani' },
  { code: 'mai', label: 'मैथिली',             labelEnglish: 'Maithili' },
  { code: 'ml',  label: 'മലയാളം',             labelEnglish: 'Malayalam' },
  { code: 'mr',  label: 'मराठी',              labelEnglish: 'Marathi' },
  { code: 'mni', label: 'মীতৈ',               labelEnglish: 'Manipuri' },
  { code: 'ne',  label: 'नेपाली',              labelEnglish: 'Nepali' },
  { code: 'or',  label: 'ଓଡ଼ିଆ',               labelEnglish: 'Odia' },
  { code: 'pa',  label: 'ਪੰਜਾਬੀ',              labelEnglish: 'Punjabi' },
  { code: 'sa',  label: 'संस्कृत',              labelEnglish: 'Sanskrit' },
  { code: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ',             labelEnglish: 'Santali' },
  { code: 'ta',  label: 'தமிழ்',                labelEnglish: 'Tamil' },
  { code: 'te',  label: 'తెలుగు',                labelEnglish: 'Telugu' },
  { code: 'ur',  label: 'اردو',                 labelEnglish: 'Urdu' },
] as const;

// ─── Seasons ───────────────────────────────────────────────────────────────────

export const SEASONS = [
  { value: 'kharif',    label: 'Kharif (Monsoon)' },
  { value: 'rabi',      label: 'Rabi (Winter)' },
  { value: 'zaid',      label: 'Zaid (Summer)' },
  { value: 'year_round', label: 'Year Round' },
] as const;

// ─── Agriculture Domain Categories ─────────────────────────────────────────────

export const DOMAIN_CATEGORIES = [
  { value: 'crop_protection',  label: 'Crop Protection' },
  { value: 'spray',            label: 'Spray / Pesticide' },
  { value: 'irrigation',       label: 'Irrigation' },
  { value: 'fertilizer',       label: 'Fertilizer' },
  { value: 'soil_health',      label: 'Soil Health' },
  { value: 'seed',             label: 'Seed Management' },
  { value: 'harvest',          label: 'Harvesting' },
  { value: 'post_harvest',     label: 'Post-Harvest' },
  { value: 'weather',          label: 'Weather / Climate' },
  { value: 'market',           label: 'Market / Prices' },
  { value: 'livestock',        label: 'Livestock' },
  { value: 'other',            label: 'Other' },
] as const;

// ─── User Categories ───────────────────────────────────────────────────────────

export const USER_CATEGORIES = [
  {
    value: UserCategory.FARMER,
    label: 'Farmer',
    description: 'Individual farmer or FPO member',
    icon: 'leaf-outline',
  },
  {
    value: UserCategory.FPO,
    label: 'FPO Member',
    description: 'Farmer Producer Organization',
    icon: 'people-outline',
  },
  {
    value: UserCategory.STUDENT,
    label: 'Student',
    description: 'Agriculture university student',
    icon: 'school-outline',
  },
  {
    value: UserCategory.VOLUNTEER,
    label: 'Volunteer',
    description: 'Agriculture volunteer',
    icon: 'hand-right-outline',
  },
  {
    value: UserCategory.NGO,
    label: 'NGO Partner',
    description: 'Non-governmental organization',
    icon: 'business-outline',
  },
] as const;

// ─── Reward Tiers ─────────────────────────────────────────────────────────────

export const REWARD_TIERS = [
  { min: 1,   max: 25,   reward: 1 },
  { min: 26,  max: 250,  reward: 5 },
  { min: 251, max: 500,  reward: 10 },
] as const;

// ─── Validation Limits ─────────────────────────────────────────────────────────

export const DAILY_QUESTION_LIMIT = 20;
export const VIDEO_MAX_DURATION_SEC = 10;
export const VIDEO_MAX_SIZE_MB = 10;
export const MIN_WITHDRAWAL = 50;
export const EDIT_WINDOW_SEC = 30;
export const AI_CONFIDENCE_THRESHOLD = 90;
export const SIMILARITY_THRESHOLD = 0.9;
export const MAX_QUESTION_CHARS_FALLBACK = 500;