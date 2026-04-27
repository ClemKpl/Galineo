'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  plan?: 'free' | 'premium' | 'unlimited';
  isAdmin?: boolean;
  notif_project_updates?: number;
  notif_added_to_project?: number;
  notif_deadlines?: number;
  notif_mentions?: number;
  notif_task_completed?: number;
  notif_ai_responses?: number;
  notif_chat_messages?: number;
  onboarding_status?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const freshUser = await api.get('/users/me');
      if (freshUser) {
        localStorage.setItem('galineo_user', JSON.stringify(freshUser));
        setUser(freshUser);
      }
    } catch (err: any) {
      console.error('❌ Failed to refresh user profile:', err);
      // Si le token est invalide (401) ou banni (403), on déconnecte proprement
      if (err.status === 401 || err.status === 403) {
        console.warn('⚠️ Session invalide ou expirée, déconnexion...');
        logout();
      }
    }
  };

  useEffect(() => {
    const t = localStorage.getItem('galineo_token');
    const u = localStorage.getItem('galineo_user');
    
    const initAuth = async () => {
      if (t) {
        setToken(t);
        if (u) setUser(JSON.parse(u));
        
        // Refresh from DB to ensure name/avatar/notifs are synced
        await refreshUser();
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('galineo_token', newToken);
    localStorage.setItem('galineo_user', JSON.stringify(newUser));
    setToken(newToken); setUser(newUser);
    router.push('/dashboard');
  };

  const updateUser = (newUser: User) => {
    const merged = { ...user, ...newUser } as User;
    localStorage.setItem('galineo_user', JSON.stringify(merged));
    setUser(merged);
  };

  const logout = () => {
    localStorage.removeItem('galineo_token');
    localStorage.removeItem('galineo_user');
    setToken(null); setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, updateUser, refreshUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
