import { AccountLockedInfo } from '../api/client';

type AccountLockedListener = (info: AccountLockedInfo) => void;

class AccountLockedEventEmitter {
  private listeners = new Set<AccountLockedListener>();

  emit(info: AccountLockedInfo) {
    this.listeners.forEach((l) => l(info));
  }

  subscribe(listener: AccountLockedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const accountLockedEmitter = new AccountLockedEventEmitter();

// ─── Auth Cleared (401 / token invalid / logout) ──────────────────────────────
// Fired by the API client when the 401 interceptor clears tokens, and by
// useAuth when it processes that event so the UI can navigate to login.

type AuthClearedListener = () => void;

class AuthClearedEventEmitter {
  private listeners = new Set<AuthClearedListener>();

  emit() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: AuthClearedListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const authClearedEmitter = new AuthClearedEventEmitter();