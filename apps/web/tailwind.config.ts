// apps/web/tailwind.config.ts
// Fondo carbón oscuro, blanco hueso, rojo como único acento (referencia W:O:A).
// No hay documento de diseño de frontend en `docs/`: estos tokens son la única
// definición de la paleta, así que no hardcodees hex fuera de aquí.
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1E2024',
        stripe: '#292C31',
        fg: '#EDEDE8',
        rule: '#3A3D42',
        muted: '#9B9C9F',
        accent: '#C8102E',
        'accent-bright': '#E2434F',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
