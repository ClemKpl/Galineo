'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie-notice-dismissed')) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem('cookie-notice-dismissed', '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-stone-900 text-white rounded-2xl shadow-2xl p-4 flex flex-col gap-3 border border-stone-700">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0">🍪</span>
          <p className="text-sm text-stone-300 leading-relaxed">
            Galinéo utilise uniquement un cookie de session pour maintenir votre connexion. Aucun cookie publicitaire ou de tracking.{' '}
            <Link href="/legal/confidentialite" target="_blank" className="text-orange-400 hover:text-orange-300 underline underline-offset-2">
              En savoir plus
            </Link>
          </p>
        </div>
        <button
          onClick={dismiss}
          className="self-end px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition-colors"
        >
          OK, compris
        </button>
      </div>
    </div>
  );
}
