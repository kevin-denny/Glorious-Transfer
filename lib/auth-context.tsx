'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api-client';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'administrator' | 'finance' | 'operations';
}

interface AuthContextType {
  user: User | null;
  profile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we're in the browser before accessing localStorage
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    
    const token = localStorage.getItem('auth_token');
    if (token) {
      api.getCurrentUser()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('auth_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function signIn(email: string, password: string) {
    const { token, user: userData } = await api.login(email, password);
    localStorage.setItem('auth_token', token);
    setUser(userData);
  }

  async function signOut() {
    localStorage.removeItem('auth_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile: user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
