'use client';
import { Suspense, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

const getBackendBase = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('localhost')) return envUrl.replace('/api', '').replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://galineo-api.onrender.com';
  }
  return 'http://localhost:3001';
};
const BACKEND_URL = getBackendBase();

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-stone-400">Chargement...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const joinToken = searchParams.get('join');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      
      if (joinToken) {
        router.push(`/join/${joinToken}`);
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-500/20">
          <Logo size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-stone-900" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</h1>
        <p className="text-stone-500 mt-1">Connectez-vous à votre espace</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
              placeholder="vous@exemple.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-stone-200" />
          <span className="text-xs text-stone-400">ou</span>
          <div className="flex-1 h-px bg-stone-200" />
        </div>

        <a href={`${BACKEND_URL}/auth/google`}
          className="w-full py-2.5 px-4 border border-stone-200 hover:bg-stone-50 text-stone-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-3">
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continuer avec Google
        </a>

        <p className="text-center text-sm text-stone-500 mt-6">
          Pas encore de compte ?{' '}
          <Link href={`/register${joinToken ? `?join=${joinToken}` : ''}`} className="text-orange-500 hover:text-orange-600 font-semibold">
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
