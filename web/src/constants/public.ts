/**
 * Public-user-facing constants — dropdown options, state list, reward tiers.
 * Mirrors mobile/src/utils/constants.ts so the web signup wizard and
 * ask-question form share vocabulary with the mobile app.
 */
import type { UserCategory } from '@/types'

export const LANGUAGES: { code: string; label: string; labelEnglish: string }[] = [
  { code: 'en', label: 'English', labelEnglish: 'English' },
  { code: 'as', label: 'Assamese', labelEnglish: 'Assamese' },
  { code: 'bn', label: 'Bengali', labelEnglish: 'Bengali' },
  { code: 'brx', label: 'Bodo', labelEnglish: 'Bodo' },
  { code: 'doi', label: 'Dogri', labelEnglish: 'Dogri' },
  { code: 'gu', label: 'Gujarati', labelEnglish: 'Gujarati' },
  { code: 'hi', label: 'Hindi', labelEnglish: 'Hindi' },
  { code: 'kn', label: 'Kannada', labelEnglish: 'Kannada' },
  { code: 'ks', label: 'Kashmiri', labelEnglish: 'Kashmiri' },
  { code: 'kok', label: 'Konkani', labelEnglish: 'Konkani' },
  { code: 'mai', label: 'Maithili', labelEnglish: 'Maithili' },
  { code: 'ml', label: 'Malayalam', labelEnglish: 'Malayalam' },
  { code: 'mr', label: 'Marathi', labelEnglish: 'Marathi' },
  { code: 'mni', label: 'Manipuri', labelEnglish: 'Manipuri' },
  { code: 'ne', label: 'Nepali', labelEnglish: 'Nepali' },
  { code: 'or', label: 'Odia', labelEnglish: 'Odia' },
  { code: 'pa', label: 'Punjabi', labelEnglish: 'Punjabi' },
  { code: 'sa', label: 'Sanskrit', labelEnglish: 'Sanskrit' },
  { code: 'sat', label: 'Santali', labelEnglish: 'Santali' },
  { code: 'ta', label: 'Tamil', labelEnglish: 'Tamil' },
  { code: 'te', label: 'Telugu', labelEnglish: 'Telugu' },
  { code: 'ur', label: 'Urdu', labelEnglish: 'Urdu' },
]

export const SEASONS: { value: string; label: string }[] = [
  { value: 'Kharif', label: 'Kharif' },
  { value: 'Rabi', label: 'Rabi' },
  { value: 'Zaid', label: 'Zaid' },
  { value: 'Pre-Kharif', label: 'Pre-Kharif' },
  { value: 'Post-Kharif', label: 'Post-Kharif' },
  { value: 'Pre-Rabi', label: 'Pre-Rabi' },
  { value: 'Zaid Rabi', label: 'Zaid Rabi' },
  { value: 'Spring', label: 'Spring' },
  { value: 'Summer', label: 'Summer' },
  { value: 'Autumn', label: 'Autumn' },
  { value: 'Winter', label: 'Winter' },
  { value: 'Monsoon', label: 'Monsoon' },
  { value: 'Dry Season', label: 'Dry Season' },
  { value: 'Wet Season', label: 'Wet Season' },
]

export const DOMAINS: { value: string; label: string }[] = [
  { value: 'Soil Health and Nutrient Management', label: 'Soil Health and Nutrient Management' },
  { value: 'Irrigation and Water Management', label: 'Irrigation and Water Management' },
  { value: 'Insect - Pest Management', label: 'Insect - Pest Management' },
  { value: 'Disease Management', label: 'Disease Management' },
  { value: 'Seed and Variety Selection', label: 'Seed and Variety Selection' },
  { value: 'Cultural and Crop Management Practices', label: 'Cultural and Crop Management Practices' },
  { value: 'Organic and Natural Farming', label: 'Organic and Natural Farming' },
  { value: 'Weed Management', label: 'Weed Management' },
  { value: 'Climate, Weather & Stress Management', label: 'Climate, Weather & Stress Management' },
  { value: 'Farm Tools & Mechanisation', label: 'Farm Tools & Mechanisation' },
  { value: 'Post-Harvest Management & Storage', label: 'Post-Harvest Management & Storage' },
  { value: 'Market Prices, MSP & Marketing', label: 'Market Prices, MSP & Marketing' },
  { value: 'Agricultural Schemes & Subsidies', label: 'Agricultural Schemes & Subsidies' },
  { value: 'Credit, Loan & Insurance', label: 'Credit, Loan & Insurance' },
  { value: 'Others', label: 'Others' },
]

export interface UserCategoryOption {
  value: UserCategory
  label: string
  description: string
  color: string
  ring: string
  iconBg: string
  iconColor: string
}

export const USER_CATEGORIES: UserCategoryOption[] = [
  { value: 'farmer', label: 'Farmer', description: 'I grow crops and want answers to my farm questions', color: '#2D9A3E', ring: 'border-emerald-500', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
  { value: 'fpo', label: 'FPO Member', description: 'I belong to a Farmer Producer Organisation', color: '#7B5EA7', ring: 'border-violet-500', iconBg: 'bg-violet-100', iconColor: 'text-violet-700' },
  { value: 'student', label: 'Student', description: 'I am pursuing agricultural education', color: '#2563EB', ring: 'border-blue-500', iconBg: 'bg-blue-100', iconColor: 'text-blue-700' },
  { value: 'volunteer', label: 'Volunteer', description: 'I help farmers with information and outreach', color: '#D97706', ring: 'border-amber-500', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' },
  { value: 'ngo', label: 'NGO Partner', description: 'I represent an NGO working with the community', color: '#DC2626', ring: 'border-rose-500', iconBg: 'bg-rose-100', iconColor: 'text-rose-700' },
]

export const CROP_OPTIONS: { value: string; label: string }[] = [
  { value: 'Rice', label: 'Rice (Paddy)' },
  { value: 'Wheat', label: 'Wheat' },
  { value: 'Maize', label: 'Maize (Corn)' },
  { value: 'Bajra', label: 'Bajra (Pearl Millet)' },
  { value: 'Jowar', label: 'Jowar (Sorghum)' },
  { value: 'Ragi', label: 'Ragi (Finger Millet)' },
  { value: 'Cotton', label: 'Cotton' },
  { value: 'Sugarcane', label: 'Sugarcane' },
  { value: 'Groundnut', label: 'Groundnut (Peanut)' },
  { value: 'Soybean', label: 'Soybean' },
  { value: 'Mustard', label: 'Mustard' },
  { value: 'Sesame', label: 'Sesame (Til)' },
  { value: 'Sunflower', label: 'Sunflower' },
  { value: 'Tur', label: 'Tur (Arhar) Dal' },
  { value: 'Moong', label: 'Moong (Green Gram)' },
  { value: 'Urad', label: 'Urad (Black Gram)' },
  { value: 'Chana', label: 'Chana (Bengal Gram)' },
  { value: 'Masoor', label: 'Masoor (Lentil)' },
  { value: 'Tomato', label: 'Tomato' },
  { value: 'Onion', label: 'Onion' },
  { value: 'Potato', label: 'Potato' },
  { value: 'Brinjal', label: 'Brinjal (Eggplant)' },
  { value: 'Okra', label: 'Okra (Lady Finger)' },
  { value: 'Cabbage', label: 'Cabbage' },
  { value: 'Cauliflower', label: 'Cauliflower' },
  { value: 'Cucumber', label: 'Cucumber' },
  { value: 'Pumpkin', label: 'Pumpkin' },
  { value: 'Carrot', label: 'Carrot' },
  { value: 'Radish', label: 'Radish' },
  { value: 'Spinach', label: 'Spinach' },
  { value: 'Chilli', label: 'Chilli' },
  { value: 'Garlic', label: 'Garlic' },
  { value: 'Ginger', label: 'Ginger' },
  { value: 'Turmeric', label: 'Turmeric' },
  { value: 'Banana', label: 'Banana' },
  { value: 'Mango', label: 'Mango' },
  { value: 'Papaya', label: 'Papaya' },
  { value: 'Guava', label: 'Guava' },
  { value: 'Pomegranate', label: 'Pomegranate' },
  { value: 'Citrus', label: 'Citrus (Orange/Lemon)' },
  { value: 'Apple', label: 'Apple' },
  { value: 'Grapes', label: 'Grapes' },
  { value: 'Watermelon', label: 'Watermelon' },
  { value: 'Coconut', label: 'Coconut' },
  { value: 'Tea', label: 'Tea' },
  { value: 'Coffee', label: 'Coffee' },
  { value: 'Other', label: 'Other' },
]
export const COURSE_OPTIONS: { value: string; label: string }[] = [
  { value: 'BSc Agriculture', label: 'BSc Agriculture' },
  { value: 'MSc Agriculture', label: 'MSc Agriculture' },
  { value: 'BSc Horticulture', label: 'BSc Horticulture' },
  { value: 'MSc Horticulture', label: 'MSc Horticulture' },
  { value: 'BSc Agricultural Engineering', label: 'BSc Agricultural Engineering' },
  { value: 'BTech Agricultural Engineering', label: 'BTech Agricultural Engineering' },
  { value: 'BSc Animal Science', label: 'BSc Animal Science' },
  { value: 'BSc Dairy Science', label: 'BSc Dairy Science' },
  { value: 'BSc Fisheries Science', label: 'BSc Fisheries Science' },
  { value: 'BSc Food Technology', label: 'BSc Food Technology' },
  { value: 'BSc Agricultural Economics', label: 'BSc Agricultural Economics' },
  { value: 'MBA Agribusiness', label: 'MBA Agribusiness' },
  { value: 'BSc Botany', label: 'BSc Botany' },
  { value: 'BSc Zoology', label: 'BSc Zoology' },
  { value: 'BSc Microbiology', label: 'BSc Microbiology' },
  { value: 'BSc Biotechnology', label: 'BSc Biotechnology' },
  { value: 'BSc Environmental Science', label: 'BSc Environmental Science' },
  { value: 'BSc Chemistry', label: 'BSc Chemistry' },
  { value: 'BSc Physics', label: 'BSc Physics' },
  { value: 'BSc Mathematics', label: 'BSc Mathematics' },
  { value: 'BSc Computer Science', label: 'BSc Computer Science' },
  { value: 'BCA', label: 'BCA' },
  { value: 'BSc General', label: 'BSc (General)' },
  { value: 'MSc General', label: 'MSc (General)' },
  { value: 'Other', label: 'Other' },
]

export const ORG_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Agriculture', label: 'Agriculture' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Education', label: 'Education' },
  { value: 'Water & Sanitation', label: 'Water & Sanitation' },
  { value: 'Livelihoods', label: 'Livelihoods' },
  { value: 'Women & Child Development', label: 'Women & Child Development' },
  { value: 'Youth Development', label: 'Youth Development' },
  { value: 'Environment & Climate', label: 'Environment & Climate' },
  { value: 'Disaster Relief', label: 'Disaster Relief & Emergency Response' },
  { value: 'Banking & Finance', label: 'Banking & Finance' },
  { value: 'Governance & Advocacy', label: 'Governance & Advocacy' },
  { value: 'Rural Development', label: 'Rural Development' },
  { value: 'Urban Development', label: 'Urban Development' },
  { value: 'Community Development', label: 'Community Development' },
  { value: 'Social Welfare', label: 'Social Welfare' },
  { value: 'Poverty Alleviation', label: 'Poverty Alleviation' },
  { value: 'Animal Husbandry', label: 'Animal Husbandry' },
  { value: 'Dairy Development', label: 'Dairy Development' },
  { value: 'Fisheries', label: 'Fisheries' },
  { value: 'Horticulture', label: 'Horticulture' },
  { value: 'Forestry', label: 'Forestry' },
  { value: 'Organic Farming', label: 'Organic Farming' },
  { value: 'School Education', label: 'School Education' },
  { value: 'Higher Education', label: 'Higher Education' },
  { value: 'Vocational Training', label: 'Vocational Training' },
  { value: 'Skill Development', label: 'Skill Development' },
  { value: 'Digital Literacy', label: 'Digital Literacy' },
  { value: 'Research & Innovation', label: 'Research & Innovation' },
  { value: 'Public Health', label: 'Public Health' },
  { value: 'Mental Health', label: 'Mental Health' },
  { value: 'Nutrition', label: 'Nutrition' },
  { value: 'Maternal Health', label: 'Maternal Health' },
  { value: 'Child Health', label: 'Child Health' },
  { value: 'Disability Support', label: 'Disability Support' },
  { value: 'Elderly Care', label: 'Elderly Care' },
  { value: 'Other', label: 'Other' },
]

export const SUPPORTED_STATES: { value: string; label: string }[] = [
  { value: 'Andhra Pradesh', label: 'Andhra Pradesh' },
  { value: 'Arunachal Pradesh', label: 'Arunachal Pradesh' },
  { value: 'Assam', label: 'Assam' },
  { value: 'Bihar', label: 'Bihar' },
  { value: 'Chhattisgarh', label: 'Chhattisgarh' },
  { value: 'Goa', label: 'Goa' },
  { value: 'Gujarat', label: 'Gujarat' },
  { value: 'Haryana', label: 'Haryana' },
  { value: 'Himachal Pradesh', label: 'Himachal Pradesh' },
  { value: 'Jharkhand', label: 'Jharkhand' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Kerala', label: 'Kerala' },
  { value: 'Madhya Pradesh', label: 'Madhya Pradesh' },
  { value: 'Maharashtra', label: 'Maharashtra' },
  { value: 'Manipur', label: 'Manipur' },
  { value: 'Meghalaya', label: 'Meghalaya' },
  { value: 'Mizoram', label: 'Mizoram' },
  { value: 'Nagaland', label: 'Nagaland' },
  { value: 'Odisha', label: 'Odisha' },
  { value: 'Punjab', label: 'Punjab' },
  { value: 'Rajasthan', label: 'Rajasthan' },
  { value: 'Sikkim', label: 'Sikkim' },
  { value: 'Tamil Nadu', label: 'Tamil Nadu' },
  { value: 'Telangana', label: 'Telangana' },
  { value: 'Tripura', label: 'Tripura' },
  { value: 'Uttar Pradesh', label: 'Uttar Pradesh' },
  { value: 'Uttarakhand', label: 'Uttarakhand' },
  { value: 'West Bengal', label: 'West Bengal' },
  { value: 'Delhi', label: 'Delhi' },
  { value: 'Jammu & Kashmir', label: 'Jammu & Kashmir' },
  { value: 'Ladakh', label: 'Ladakh' },
  { value: 'Puducherry', label: 'Puducherry' },
]

export interface RewardTier {
  min: number
  max: number
  reward: number
}

export const REWARD_TIERS: RewardTier[] = [
  { min: 1, max: 25, reward: 1 },
  { min: 26, max: 250, reward: 5 },
  { min: 251, max: 500, reward: 10 },
]

export const MAX_QUESTION_CHARS = 500
export const DAILY_QUESTION_LIMIT = 20

export const GENDER_OPTIONS: { value: 'male' | 'female' | 'other'; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export function categoryLabel(c: UserCategory | string | null | undefined): string {
  if (!c) return '—'
  return USER_CATEGORIES.find((x) => x.value === c)?.label ?? c
}