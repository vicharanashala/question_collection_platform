// Module registry — canonical list of all feature modules in the application.
// Import modules from ./modules/<name>/<name>.module.ts

export const MODULE_REGISTRY: Record<string, string> = {
  auth:      'src/modules/auth/auth.module.ts',
  user:      'src/modules/user/user.module.ts',
  question:  'src/modules/question/question.module.ts',
  admin:     'src/modules/admin/admin.module.ts',
  notification: 'src/modules/notification/notifications.module.ts',
  wallets:   'src/modules/wallets/wallets.module.ts',
  speech:    'src/modules/speech/speech.module.ts',
  lgd:       'src/modules/lgd/lgd.module.ts',
  payment:   'src/modules/payment/payment.module.ts',
  storage:   'src/modules/storage/storage.module.ts',
  ai:        'src/modules/ai/ai.module.ts',
  reports:   'src/modules/reports/reports.module.ts',
  faqs:      'src/modules/faqs/faqs.module.ts',
} as const;

export type ModuleName = keyof typeof MODULE_REGISTRY;

/** Pre-load hook — run before NestFactory.create() */
export async function preloadServices(): Promise<void> {
  // TODO: run DB migrations, warm cache, etc.
}