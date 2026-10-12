import type { AuthUser } from '@/types'

/** Routes that only make sense for users who are paid for their submissions. */
export const PAYMENT_ROUTES = ['/home/wallet', '/home/payment-methods']

// Wallet and payment features are hidden for every user until they launch. Restore the
// original rule (return !user?.isAnveshanUser) to bring them back for non-Anveshan users.
export function canAccessPayments(_user: Pick<AuthUser, 'isAnveshanUser'> | null | undefined): boolean {
  return false
}
