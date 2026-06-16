import { AccountLockedInfo } from '../api/client';

type Listener = (info: AccountLockedInfo) => void;

class AccountLockedEventEmitter {
  private listeners = new Set<Listener>();

  emit(info: AccountLockedInfo) {
    this.listeners.forEach((l) => l(info));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const accountLockedEmitter = new AccountLockedEventEmitter();