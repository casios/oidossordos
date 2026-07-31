// apps/web/tailwind.config.ts
// Tokens tomados directamente de diseno-frontend.md sección 5.2 —
// fondo carbón oscuro, blanco hueso, rojo como único acento (referencia W:O:A).
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
