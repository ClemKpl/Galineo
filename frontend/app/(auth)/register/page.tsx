'use client';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-stone-400">Chargement...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill email or handle join redirects
  const inviteToken = searchParams.get('invite');
  const joinToken = searchParams.get('join');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/register', { name, email, password });
      login(data.token, data.user);
      
      if (joinToken) {
        router.push(`/join/${joinToken}`);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
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
        <p className="text-stone-500 mt-1">Créez votre compte</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Nom complet</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
              placeholder="Votre nom" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
              placeholder="vous@exemple.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all"
              placeholder="Min. 6 caractères" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        <p className="text-center text-sm text-stone-500 mt-6">
          Déjà un compte ?{' '}
          <Link href={`/login${joinToken ? `?join=${joinToken}` : ''}`} className="text-orange-500 hover:text-orange-600 font-semibold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
