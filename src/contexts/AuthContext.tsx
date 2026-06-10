
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext<any>({});

type AppRole = 'student' | 'staff' | 'warden';

type LocalUser = {
  id: string;
  rollNo?: string;
  email: string;
  name: string;
  role: AppRole;
  hostelId: string;
  foodPreference: 'veg' | 'non_veg';
};

export type SignUpMetadata = {
  rollNo?: string;
  fullName?: string;
  role?: AppRole;
  hostelId?: string;
  foodPreference?: 'veg' | 'non_veg';
};

type AuthResponse = {
  user: LocalUser;
  session: { local: true; rememberMe?: boolean };
};

type SignUpResponse = {
  success: boolean;
  user: LocalUser;
};

const STORAGE_KEY = 'messmate_local_user';
const VALID_ROLES: AppRole[] = ['student', 'staff', 'warden'];

function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && VALID_ROLES.includes(value as AppRole);
}

function isLocalUser(value: unknown): value is LocalUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LocalUser>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.hostelId === 'string' &&
    (candidate.foodPreference === undefined || typeof candidate.foodPreference === 'string') &&
    isAppRole(candidate.role)
  );
}

  function normalizeRole(value: unknown): AppRole | null {
    return isAppRole(value) ? value : null;
  }

  function normalizeLocalUser(value: unknown): LocalUser | null {
    if (!isLocalUser(value)) {
      return null;
    }

    const role = normalizeRole(value.role);
    if (!role) {
      return null;
    }

    return {
      ...value,
      role,
      foodPreference: (value.foodPreference === 'veg' ? 'veg' : 'non_veg') as 'veg' | 'non_veg',
    };
  }

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
  }

  return payload as T;
}

function readStoredUser(): LocalUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate = (parsed.user && typeof parsed.user === 'object') ? parsed.user : parsed;

    if (!isLocalUser(candidate)) {
      window.localStorage.removeItem(STORAGE_KEY);
      if (process.env.NODE_ENV !== 'production') {
        console.info('[messmate][auth] Removed incompatible stored auth state.');
      }
      return null;
    }

      const normalized = normalizeLocalUser(candidate);
      if (!normalized) {
        window.localStorage.removeItem(STORAGE_KEY);
        if (process.env.NODE_ENV !== 'production') {
          console.info('[messmate][auth] Removed incompatible stored auth state.');
        }
        return null;
      }

    return normalized;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistUser(user: LocalUser | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (user) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function clearPersistedUser() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [session, setSession] = useState<{ local: true } | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadCurrentUser = async (): Promise<LocalUser | null> => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (!res.ok) {
        return user;
      }

      const payload = await res.json().catch(() => null);
      const nextUser = normalizeLocalUser(payload?.user);
      if (!nextUser) {
        return user;
      }

      setUser(nextUser);
      setSession({ local: true });
      persistUser(nextUser);
      return nextUser;
    } catch {
      return user;
    }
  };

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[messmate][auth] AuthProvider initializing.');
    }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!mounted) return;
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          const nextUser = normalizeLocalUser(payload?.user);
          if (nextUser) {
            setUser(nextUser);
            // keep legacy localStorage for consumers, but prefer server identity
            persistUser(nextUser);
            setSession({ local: true });
            setLoading(false);
            return;
          }
        }
      } catch (_e) {
        // rely on server session only
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const signUp = async (email: string, password: string, metadata: SignUpMetadata = {}) => {
    const normalizedEmail = email.trim().toLowerCase();
    const response = await postJson<SignUpResponse>('/api/auth/signup', {
      rollNo: metadata.rollNo,
      email: normalizedEmail,
      password,
      name: metadata.fullName || 'MessMate User',
      role: metadata.role || 'student',
      hostelId: metadata.hostelId || 'A',
      foodPreference: metadata.foodPreference || 'non_veg',
    });

    setSession(null);
    setUser(null);
    clearPersistedUser();
    return response;
  };

  const signIn = async (identifier: string, password: string, options: { rememberMe?: boolean } = {}) => {
    const response = await postJson<AuthResponse>('/api/auth/signin', {
      email: identifier, // server still uses 'email' key in body but handles rollNo
      password,
      rememberMe: Boolean(options.rememberMe),
    });

    setSession(response.session);
    const nextUser = normalizeLocalUser(response.user);
    if (!nextUser) {
      throw new Error('Invalid session payload.');
    }

    setUser(nextUser);
    if (options.rememberMe) {
      persistUser(nextUser);
    } else {
      clearPersistedUser();
    }
    return { ...response, user: nextUser };
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // ignore network errors - still clear client state
    }
    setUser(null);
    setSession(null);
    persistUser(null);
  };

  const getCurrentUser = async () => user;

  const getUserProfile = async () => user;

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    reloadCurrentUser,
    getUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
