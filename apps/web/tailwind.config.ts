// apps/web/tailwind.config.ts
// Tokens tomados directamente de diseno-frontend.md sección 5.2 —
// fondo negro, blanco hueso, cobre fundido como único acento.
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        stripe: '#141414',
        fg: '#EDEDE8',
        rule: '#2B2B29',
        muted: '#8A8A85',
        accent: '#C9622E',
        'accent-bright': '#E08148',
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
