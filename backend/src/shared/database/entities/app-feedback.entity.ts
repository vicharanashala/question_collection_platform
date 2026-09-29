export type AppFeedbackContext = 'anveshan_completion';
export type AppFeedbackInputMethod = 'text' | 'voice';

/** A user's rating and comment about the app, collected at a specific moment (context). */
export class AppFeedback {
  id: string;
  userId: string;
  context: AppFeedbackContext;
  /** 1 to 5 stars. */
  rating: number;
  comment: string | null;
  /** Whether the comment was dictated with the microphone or typed. */
  inputMethod: AppFeedbackInputMethod;
  createdAt: Date;
  updatedAt: Date;
}
