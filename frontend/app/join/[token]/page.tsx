'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export default function JoinProjectPage() {
  const { token } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Redirect to register but remember the token
      router.push(`/register?join=${token}`);
      return;
    }

    async function join() {
      try {
        const res = await api.post(`/projects/join/${token}`, {});
        setStatus('success');
        setTimeout(() => {
          router.push(`/projects/${res.projectId}`);
        }, 1500);
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Lien invalide ou expiré.');
      }
    }

    join();
  }, [user, authLoading, token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto">
          <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
          </svg>
        </div>

        {status === 'loading' && (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-stone-900">Rejoint du projet...</h1>
            <p className="text-stone-500">Un instant, nous validons votre invitation.</p>
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-green-600">Bienvenue !</h1>
            <p className="text-stone-500">Vous avez rejoint le projet avec succès. Redirection en cours...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-red-600">Oups !</h1>
            <p className="text-stone-600 font-medium">{error}</p>
            <p className="text-sm text-stone-400">Ce lien est peut-être expiré ou a été révoqué par le propriétaire du projet.</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-bold w-full"
            >
              Retour au tableau de bord
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
