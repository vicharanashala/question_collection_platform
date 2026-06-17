import { UserCategory } from '../types';

// ─── API Base URL ─────────────────────────────────────────────────────────────
// In production, replace with your deployed backend URL
export const API_BASE_URL = 'http://192.168.1.5:3000/api/v1';

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