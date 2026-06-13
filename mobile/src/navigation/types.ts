import { PublicUser } from '../types';

export type AuthStackParamList = {
  LoginPhone: undefined;
  Otp: { mobileNumber: string };
  Consent: { mobileNumber: string };
  Register: { mobileNumber: string };
};

export type MainTabParamList = {
  HomeTab: undefined;
  MyQuestions: undefined;
  AskQuestion: { questionId?: string } | undefined;
  Wallet: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Screen props for useNavigation hooks
export type { PublicUser };