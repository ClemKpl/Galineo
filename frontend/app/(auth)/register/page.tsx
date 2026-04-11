'use client';
import { useState, useEffect, Suspense } from 'react';
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
  
  const [step, setStep] = useState(1); // 1: Info, 2: OTP
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Pre-fill email or handle join redirects
  const joinToken = searchParams.get('join');

  const requestOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/verify-email/request', { email });
      setStep(2);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.post('/auth/register', { name, email, password, code });
      login(data.token, data.user);
      if (joinToken) router.push(`/join/${joinToken}`);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await api.post('/auth/verify-email/request', { email });
      setError(''); // Clear error on success
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-500/20">
          <Logo size={28} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-stone-900 uppercase tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</h1>
        <p className="text-stone-500 mt-1">
          {step === 1 ? 'Créez votre compte' : 'Vérifiez votre email'}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-200 p-8">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 mb-6 flex items-start gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
             <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={requestOTP} className="space-y-5" noValidate>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">Nom complet</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-orange-400/10 focus:border-orange-400 transition-all outline-none"
                placeholder="Ex: John Doe" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-orange-400/10 focus:border-orange-400 transition-all outline-none"
                placeholder="vous@exemple.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">Mot de passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-orange-400/10 focus:border-orange-400 transition-all outline-none"
                placeholder="Min. 8 carac. + majuscule" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25">
              {loading && <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loading ? 'Vérification...' : 'Continuer'}
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400">ou</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            <a href={`${BACKEND_URL}/auth/google`}
              className="w-full py-3 px-4 border border-stone-200 hover:bg-stone-50 text-stone-700 font-bold rounded-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continuer avec Google
            </a>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6" noValidate>
            <div className="text-center">
              <div className="text-stone-600 mb-4 bg-stone-50 py-3 px-4 rounded-xl border border-stone-100 italic text-sm">
                Un code a été envoyé à <span className="font-semibold text-stone-900 not-italic">{email}</span>
              </div>
              <label className="block text-sm font-bold text-stone-700 mb-2">Code de confirmation</label>
              <input 
                type="text" 
                value={code} 
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                required
                maxLength={6}
                autoFocus
                className="w-full text-center text-3xl tracking-[1.2rem] font-mono px-4 py-4 rounded-2xl border-2 border-stone-200 text-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-400/10 focus:border-orange-400 transition-all bg-stone-50"
                placeholder="000000" />
              <p className="mt-3 text-xs text-stone-500 uppercase tracking-widest font-semibold">Saisissez les 6 chiffres</p>
            </div>

            <div className="space-y-3">
              <button type="submit" disabled={loading}
                className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25">
                {loading && <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Finalisation...' : 'Confirmer et Créer'}
              </button>
              
              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 text-sm text-stone-500 font-semibold hover:text-stone-700 hover:bg-stone-50 rounded-xl transition-all">
                  ← Retour
                </button>
                <div className="w-px h-4 bg-stone-200" />
                <button type="button" onClick={handleResend} disabled={resendLoading} className="flex-1 py-3 text-sm text-orange-500 font-semibold hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all">
                  {resendLoading ? 'Envoi...' : 'Renvoyer le code'}
                </button>
              </div>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-stone-500 mt-8">
          Déjà un compte ?{' '}
          <Link href={`/login${joinToken ? `?join=${joinToken}` : ''}`} className="text-orange-500 hover:text-orange-600 font-bold">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
