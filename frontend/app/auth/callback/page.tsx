'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/login?error=google_failed');
      return;
    }

    // Récupère le profil complet avec le token
    api.get('/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        login(token, res.data);
        router.replace('/dashboard');
      })
      .catch(() => {
        router.replace('/login?error=google_failed');
      });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground text-sm">Connexion en cours…</p>
    </div>
  );
}
