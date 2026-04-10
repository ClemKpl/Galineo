'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground text-sm">Connexion en cours…</p></div>}>
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackHandler() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/login?error=google_failed');
      return;
    }

    // Stocke le token temporairement pour que api.get puisse l'utiliser
    localStorage.setItem('galineo_token', token);

    api.get('/users/me')
      .then((res) => {
        login(token, res);
        router.replace('/dashboard');
      })
      .catch(() => {
        localStorage.removeItem('galineo_token');
        router.replace('/login?error=google_failed');
      });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground text-sm">Connexion en cours…</p>
    </div>
  );
}

