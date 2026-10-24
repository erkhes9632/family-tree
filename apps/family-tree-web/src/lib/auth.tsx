'use client';
import * as React from 'react';
import { useAuth as useClerkAuth, useClerk } from '@clerk/nextjs';
import { CLERK_ENABLED, DEV_USER_COOKIE } from './config';

export interface AuthState {
  mode: 'clerk' | 'dev';
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

function readDevUser(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${DEV_USER_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

const devListeners = new Set<() => void>();
export function devSignIn(userId: string) {
  document.cookie = `${DEV_USER_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  devListeners.forEach((l) => l());
}
export function devSignOut() {
  document.cookie = `${DEV_USER_COOKIE}=; path=/; max-age=0`;
  devListeners.forEach((l) => l());
}

function DevAuthProvider({ children }: { children: React.ReactNode }) {
  const userId = React.useSyncExternalStore(
    (cb) => {
      devListeners.add(cb);
      return () => devListeners.delete(cb);
    },
    readDevUser,
    () => null,
  );
  const [isLoaded, setLoaded] = React.useState(false);
  React.useEffect(() => setLoaded(true), []);
  const value = React.useMemo<AuthState>(
    () => ({
      mode: 'dev',
      isLoaded,
      isSignedIn: !!userId,
      userId,
      getToken: async () => (userId ? `dev:${userId}` : null),
      signOut: async () => devSignOut(),
    }),
    [userId, isLoaded],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useClerkAuth();
  const clerk = useClerk();
  const value = React.useMemo<AuthState>(
    () => ({
      mode: 'clerk',
      isLoaded,
      isSignedIn: !!isSignedIn,
      userId: userId ?? null,
      getToken: () => getToken(),
      signOut: () => clerk.signOut(),
    }),
    [isLoaded, isSignedIn, userId, getToken, clerk],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return CLERK_ENABLED ? <ClerkAuthBridge>{children}</ClerkAuthBridge> : <DevAuthProvider>{children}</DevAuthProvider>;
}

export function useAuthState(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuthState must be used inside <AuthProvider>');
  return ctx;
}
