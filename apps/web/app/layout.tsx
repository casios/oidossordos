// apps/web/app/layout.tsx
import type { Metadata } from 'next';
import { Masthead } from '../components/Masthead';
import { PrimaryNav } from '../components/PrimaryNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agenda Metal Colaborativa',
  description: 'Conciertos y festivales de metal, cargados por la comunidad.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black text-fg font-display">
        {/* Marco general (Propuesta A) — masthead + nav persistentes en
            todo el sitio; la barra utilitaria y el layout de dos columnas
            son responsabilidad de cada página, ver diseno-frontend.md 5.0 */}
        <Masthead />
        <PrimaryNav />
        {children}
      </body>
    </html>
  );
}
