import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import InitialSplashScreen from '@/components/InitialSplashScreen';

export const metadata: Metadata = {
  title: 'Galineo — De l\'idée au projet structuré, en quelques secondes.',
  description: 'Galineo est la plateforme de gestion de projets propulsée par l\'IA. Créez, organisez et pilotez vos projets collaborativement grâce au Wizard IA et à la Galineo Room.',
  keywords: ['gestion de projets', 'IA', 'intelligence artificielle', 'collaboration', 'kanban', 'wizard', 'productivité', 'équipe'],
  authors: [{ name: 'Galineo' }],
  creator: 'Galineo',
  metadataBase: new URL('https://galineo.fr'),
  openGraph: {
    title: 'Galineo — De l\'idée au projet structuré, en quelques secondes.',
    description: 'Créez, organisez et pilotez vos projets collaborativement grâce au Wizard IA et à la Galineo Room.',
    url: 'https://galineo.fr',
    siteName: 'Galineo',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galineo — Gestion de projets propulsée par l\'IA',
    description: 'De l\'idée au projet structuré, en quelques secondes.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <ThemeProvider>
            <InitialSplashScreen />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
