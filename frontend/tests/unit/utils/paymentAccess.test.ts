import { describe, expect, it } from 'vitest'
import { canAccessPayments, PAYMENT_ROUTES } from '@/utils/paymentAccess'
import { buildAuthUser } from '../../utils/factories'

describe('utils/paymentAccess', () => {
  it('lists the wallet and payment method routes', () => {
    expect(PAYMENT_ROUTES).toEqual(['/home/wallet', '/home/payment-methods'])
  })

  // Payments are switched off for everyone until launch. Update these expectations when they are re-enabled.
  it.each([
    ['a regular user', buildAuthUser({ isAnveshanUser: false })],
    ['an Anveshan user', buildAuthUser({ isAnveshanUser: true })],
    ['no user', null],
  ])('hides payments for %s while the feature is disabled', (_case, user) => {
    expect(canAccessPayments(user)).toBe(false)
  })
})
