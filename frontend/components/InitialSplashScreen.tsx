'use client';

import { useState, useEffect } from 'react';
import Logo from './Logo';

/**
 * SplashScreen affiché uniquement lors du premier chargement de la session (sessionStorage).
 * Affiche le logo Galinéo centré sur fond blanc avec un effet de fondu.
 */
export default function InitialSplashScreen() {
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // On utilise sessionStorage pour que ça ne s'affiche qu'une fois par onglet/session
    const hasSeen = sessionStorage.getItem('galineo_splash_seen');
    
    if (!hasSeen) {
      setShouldRender(true);
      
      // Petit délai pour assurer que l'animation d'entrée se déclenche si on ajoute des classes
      const timer = setTimeout(() => {
        setVisible(true);
      }, 50);

      // Début de la disparition après 1.8s
      const fadeTimer = setTimeout(() => {
        setVisible(false);
      }, 1800);

      // Retrait complet du DOM après la fin de la transition CSS (700ms)
      const removeTimer = setTimeout(() => {
        setShouldRender(false);
        sessionStorage.setItem('galineo_splash_seen', 'true');
      }, 2500);

      return () => {
        clearTimeout(timer);
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, []);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-all duration-700 ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className={`flex items-center gap-4 transform transition-all duration-1000 ease-out ${
        visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        <Logo size={80} className="text-orange-500" />
        <span 
          className="text-stone-900 font-bold text-4xl tracking-tighter" 
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          GALINÉO
        </span>
      </div>
    </div>
  );
}
