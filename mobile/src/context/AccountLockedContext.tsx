import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { AccountLockedInfo } from '../api/client';
import { accountLockedEmitter } from '../events/accountLockedEvents';

interface AccountLockedContextValue {
  lockedInfo: AccountLockedInfo | null;
  setLocked: (info: AccountLockedInfo) => void;
  clearLocked: () => void;
}

const AccountLockedContext = createContext<AccountLockedContextValue | null>(null);

export function AccountLockedProvider({ children }: { children: ReactNode }) {
  const [lockedInfo, setLockedInfo] = useState<AccountLockedInfo | null>(null);

  // Listen for 423 events emitted by the API client response interceptor
  useEffect(() => {
    const sub = accountLockedEmitter.subscribe((info) => {
      setLockedInfo(info);
    });
    return sub;
  }, []);

  const setLocked = useCallback((info: AccountLockedInfo) => {
    setLockedInfo(info);
  }, []);

  const clearLocked = useCallback(() => {
    setLockedInfo(null);
  }, []);

  return (
    <AccountLockedContext.Provider value={{ lockedInfo, setLocked, clearLocked }}>
      {children}
    </AccountLockedContext.Provider>
  );
}

/**
 * Must be called inside an AccountLockedProvider.
 * Returns the current locked info and setters.
 */
export function useAccountLocked(): AccountLockedContextValue {
  const ctx = useContext(AccountLockedContext);
  if (!ctx) throw new Error('useAccountLocked must be used within AccountLockedProvider');
  return ctx;
}