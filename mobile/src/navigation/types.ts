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
  Main: undefined;
  EditProfile: undefined;
  CropManagement: undefined;
};

// Screen props for useNavigation hooks
export type { PublicUser };