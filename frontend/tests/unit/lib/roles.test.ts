import { describe, expect, it } from 'vitest'
import {
  canAccessAtLeast,
  isAdmin,
  isCurator,
  isCuratorOrAbove,
  isDistributor,
  isEndUser,
  isFinance,
  isFinanceOrAbove,
  isSuperAdmin,
  type Role,
} from '@/lib/roles'
import { buildAuthUser } from '../../utils/factories'

const ROLES: Role[] = ['user', 'curator', 'finance', 'distributor', 'admin', 'super_admin']
const as = (role: Role) => buildAuthUser({ role })

// Roles each check should accept; every other role must be rejected.
const EXPECTED: [string, (user: ReturnType<typeof as>) => boolean, Role[]][] = [
  ['isSuperAdmin', isSuperAdmin, ['super_admin']],
  ['isAdmin', isAdmin, ['admin', 'super_admin']],
  ['isCuratorOrAbove', isCuratorOrAbove, ['curator', 'admin', 'super_admin']],
  ['isFinanceOrAbove', isFinanceOrAbove, ['finance', 'admin', 'super_admin']],
  ['isDistributor', isDistributor, ['distributor']],
  ['isFinance', isFinance, ['finance']],
  ['isCurator', isCurator, ['curator']],
  ['isEndUser', isEndUser, ['user']],
]

describe('lib/roles', () => {
  describe.each(EXPECTED)('%s', (_name, check, allowed) => {
    it.each(ROLES)('handles %s', (role) => {
      expect(check(as(role))).toBe(allowed.includes(role))
    })

    it('rejects a missing user', () => {
      expect(check(null as never)).toBe(false)
      expect(check(undefined as never)).toBe(false)
    })
  })

  describe('canAccessAtLeast', () => {
    it('follows the privilege hierarchy', () => {
      expect(canAccessAtLeast(as('admin'), 'admin')).toBe(true)
      expect(canAccessAtLeast(as('super_admin'), 'admin')).toBe(true)
      expect(canAccessAtLeast(as('curator'), 'admin')).toBe(false)
    })

    it('denies users without a role and unknown roles', () => {
      expect(canAccessAtLeast(null, 'user')).toBe(false)
      expect(canAccessAtLeast(buildAuthUser({ role: 'hacker' as Role }), 'user')).toBe(false)
    })
  })
})
