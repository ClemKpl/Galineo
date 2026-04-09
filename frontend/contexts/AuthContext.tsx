'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User { 
  id: number; 
  name: string; 
  email: string; 
  avatar?: string | null;
  notif_project_updates?: number;
  notif_added_to_project?: number;
  notif_deadlines?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('galineo_token');
    const u = localStorage.getItem('galineo_user');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('galineo_token', newToken);
    localStorage.setItem('galineo_user', JSON.stringify(newUser));
    setToken(newToken); setUser(newUser);
    router.push('/dashboard');
  };

  const updateUser = (newUser: User) => {
    localStorage.setItem('galineo_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('galineo_token');
    localStorage.removeItem('galineo_user');
    setToken(null); setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, updateUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
