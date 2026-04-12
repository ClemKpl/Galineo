'use client';
import { createContext, useContext, useState, useEffect } from 'react';

export type AccentColor = 'orange' | 'blue' | 'violet' | 'emerald' | 'rose' | 'cyan';

interface ThemeContextType {
  accent: AccentColor;
  setAccent: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType>({ accent: 'orange', setAccent: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentColor>('orange');

  useEffect(() => {
    const saved = localStorage.getItem('galineo_accent') as AccentColor | null;
    if (saved && saved !== 'orange') {
      setAccentState(saved);
      document.documentElement.setAttribute('data-accent', saved);
    }
  }, []);

  const setAccent = (color: AccentColor) => {
    setAccentState(color);
    localStorage.setItem('galineo_accent', color);
    if (color === 'orange') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', color);
    }
  };

  return (
    <ThemeContext.Provider value={{ accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
