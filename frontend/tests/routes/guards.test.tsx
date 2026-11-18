import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser, UserRole } from '@/types'
import {
  AnveshanRoute,
  HomeRedirect,
  PAGE_ROLES,
  PaymentRoute,
  ProtectedRoute,
  PublicRoute,
  RoleRoute,
  RootGate,
  StaffRoute,
} from '@/routes/guards'
import { buildAuthUser } from '../utils/factories'
import { renderWithProviders } from '../utils/render'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

const auth: AuthState = { user: null, isAuthenticated: false, isLoading: false }

vi.mock('@/stores/AuthContext', () => ({ useAuth: () => auth }))

const signIn = (overrides: Partial<AuthUser> = {}) => {
  auth.user = buildAuthUser(overrides)
  auth.isAuthenticated = true
}

const Content = () => <div>secret content</div>
const location = () => screen.queryByTestId('location')?.textContent ?? null

describe('route guards', () => {
  beforeEach(() => {
    auth.user = null
    auth.isAuthenticated = false
    auth.isLoading = false
  })

  describe('ProtectedRoute', () => {
    it('redirects anonymous visitors to /login', () => {
      renderWithProviders(<ProtectedRoute><Content /></ProtectedRoute>, { route: '/dashboard' })

      expect(location()).toBe('/login')
    })

    it('renders nothing while the session is being restored', () => {
      auth.isLoading = true
      const { container } = renderWithProviders(<ProtectedRoute><Content /></ProtectedRoute>, { route: '/dashboard' })

      expect(container).toBeEmptyDOMElement()
    })

    it('renders children for signed-in users', () => {
      signIn()
      renderWithProviders(<ProtectedRoute><Content /></ProtectedRoute>, { route: '/dashboard' })

      expect(screen.getByText('secret content')).toBeInTheDocument()
    })
  })

  describe('StaffRoute', () => {
    it('sends public users to their home', () => {
      signIn({ role: 'user' })
      renderWithProviders(<StaffRoute><Content /></StaffRoute>, { route: '/dashboard' })

      expect(location()).toBe('/home')
    })

    it('lets staff in', () => {
      signIn({ role: 'curator' })
      renderWithProviders(<StaffRoute><Content /></StaffRoute>, { route: '/dashboard' })

      expect(screen.getByText('secret content')).toBeInTheDocument()
    })
  })

  describe('RootGate', () => {
    it.each([
      ['anonymous visitors', null, '/register'],
      ['public users', 'user' as UserRole, '/home'],
    ])('redirects %s', (_case, role, expected) => {
      if (role) signIn({ role })
      renderWithProviders(<RootGate><Content /></RootGate>, { route: '/' })

      expect(location()).toBe(expected)
    })

    it('renders the staff shell for staff', () => {
      signIn({ role: 'admin' })
      renderWithProviders(<RootGate><Content /></RootGate>, { route: '/' })

      expect(screen.getByText('secret content')).toBeInTheDocument()
    })
  })

  describe('PublicRoute', () => {
    it('redirects anonymous visitors to /login', () => {
      renderWithProviders(<PublicRoute><Content /></PublicRoute>, { route: '/home' })

      expect(location()).toBe('/login')
    })

    it('lets a visitor who just verified their OTP finish the profile', () => {
      renderWithProviders(<PublicRoute><Content /></PublicRoute>, { route: '/home', routeState: { mobileNumber: '9876543210' } })

      expect(screen.getByText('secret content')).toBeInTheDocument()
    })

    it('bounces staff to the dashboard', () => {
      signIn({ role: 'finance' })
      renderWithProviders(<PublicRoute><Content /></PublicRoute>, { route: '/home' })

      expect(location()).toBe('/dashboard')
    })

    it.each(['pending', 'manual_review', 'suspended'] as const)('holds %s accounts on the pending screen', (status) => {
      signIn({ verificationStatus: status })
      renderWithProviders(<PublicRoute><Content /></PublicRoute>, { route: '/home' })

      expect(location()).toBe('/home/verification-pending')
    })

    it('lets verified users in', () => {
      signIn()
      renderWithProviders(<PublicRoute><Content /></PublicRoute>, { route: '/home' })

      expect(screen.getByText('secret content')).toBeInTheDocument()
    })
  })

  describe('AnveshanRoute', () => {
    it('only admits Anveshan users', () => {
      signIn({ isAnveshanUser: false })
      renderWithProviders(<AnveshanRoute><Content /></AnveshanRoute>, { route: '/home/answers' })

      expect(location()).toBe('/home')
    })

    it('renders for Anveshan users', () => {
      signIn({ isAnveshanUser: true })
      renderWithProviders(<AnveshanRoute><Content /></AnveshanRoute>, { route: '/home/answers' })

      expect(screen.getByText('secret content')).toBeInTheDocument()
    })
  })

  describe('PaymentRoute', () => {
    it('keeps wallet pages closed while payments are disabled', () => {
      signIn()
      renderWithProviders(<PaymentRoute><Content /></PaymentRoute>, { route: '/home/wallet' })

      expect(location()).toBe('/home')
    })
  })

  describe('RoleRoute', () => {
    it('renders nothing when the role may open the page', () => {
      signIn({ role: 'super_admin' })
      const { container } = renderWithProviders(<RoleRoute pageKey="settings" />, { route: '/settings' })

      expect(container).toBeEmptyDOMElement()
    })

    it('redirects to the first page the role may open', () => {
      signIn({ role: 'finance' })
      renderWithProviders(<RoleRoute pageKey="settings" />, { route: '/settings' })

      expect(location()).toBe('/dashboard')
    })
  })

  describe('PAGE_ROLES', () => {
    it('restricts system settings to super admins', () => {
      expect(PAGE_ROLES.settings).toEqual(['super_admin'])
    })

    it('never exposes staff pages to public users', () => {
      const userPages = Object.entries(PAGE_ROLES)
        .filter(([, roles]) => roles.includes('user'))
        .map(([page]) => page)

      expect(userPages.sort()).toEqual(['faqs', 'profile'])
    })

    it('gives every staff role at least one page so RoleRoute can always redirect', () => {
      const staff: UserRole[] = ['admin', 'super_admin', 'curator', 'finance', 'distributor']

      staff.forEach((role) => expect(Object.values(PAGE_ROLES).some((roles) => roles.includes(role))).toBe(true))
    })
  })

  describe('HomeRedirect', () => {
    it.each([
      ['user' as UserRole, '/home'],
      ['admin' as UserRole, '/dashboard'],
    ])('sends %s to %s', (role, expected) => {
      signIn({ role })
      renderWithProviders(<HomeRedirect />, { route: '/start' })

      expect(location()).toBe(expected)
    })
  })
})
