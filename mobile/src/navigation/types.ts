import { PublicUser } from '../types';

export type AuthStackParamList = {
  LoginPhone: undefined;
  Otp: { mobileNumber: string };
  Consent: { mobileNumber: string };
  Terms: { mobileNumber: string };
  Register: { mobileNumber: string };
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  VerificationPending: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  Submissions: undefined;
  AskQuestion: { questionId?: string; resetForm?: boolean } | undefined;
  Wallet: undefined;
  Profile: undefined;
  AdminHome: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminUserDetail: { userId: string };
  AdminCreateUser: undefined;
  AdminQuestions: undefined;
  AdminQuestionDetail: { questionId: string };
  AdminProcessedQuestions: undefined;
  AdminConfig: undefined;
  AdminWithdrawals: undefined;
  AdminProfile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: { screen?: keyof MainTabParamList; params?: unknown } | undefined;
  EditProfile: undefined;
  CropManagement: undefined;
  NotificationScreen: undefined;
  QuestionDetail: {
    /** ID of the question to display */
    questionId: string;
  };
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
    /** Set to true after a successful submission so the ask screen clears the input */
    resetForm?: boolean;
  };
};

// Screen props for useNavigation hooks
export type { PublicUser };