import type { AuthUser } from '@/types'

/** Routes that only make sense for users who are paid for their submissions. */
export const PAYMENT_ROUTES = ['/home/wallet', '/home/payment-methods']

// Anveshan users are not paid per submission, so wallet and payment features are hidden for them.
export function canAccessPayments(user: Pick<AuthUser, 'isAnveshanUser'> | null | undefined): boolean {
  return !user?.isAnveshanUser
}
