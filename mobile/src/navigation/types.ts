import { PublicUser } from '../types';

export type AuthStackParamList = {
  LoginPhone: undefined;
  Otp: { mobileNumber: string };
  Consent: { mobileNumber: string };
  Terms: { mobileNumber: string };
  Register: { mobileNumber: string };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  Submissions: undefined;
  AskQuestion: { questionId?: string } | undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: { screen?: keyof MainTabParamList; params?: unknown } | undefined;
  EditProfile: undefined;
  CropManagement: undefined;
  QuestionPreview: {
    // Fields returned from the preview endpoint (and originally submitted by the user)
    state: string;
    district: string;
    block: string | null;
    domainCategory: string;
    season: string;
    cropType: string;
    questionText: string;
    mediaType: 'none' | 'image' | 'video' | 'audio';
    mediaUrls: string[];
    agroClimaticZone: string;
    suggestedDistricts: string[];
    suggestedBlocks: string[];
    remainingToday: number;
    dailyLimit: number;
  };
};

// Screen props for useNavigation hooks
export type { PublicUser };