import type { Config } from 'tailwindcss';

/**
 * Weedtip brand theme — dark, clean, trustworthy. "The Google Maps of cannabis."
 * Tokens here are the single source for the web UI; mirror in the Flutter theme.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        background: '#0F1117',
        surface: '#1A1D26',
        'surface-2': '#222633',
        border: '#2A2F3C',
        // Brand green
        primary: {
          DEFAULT: '#10B981',
          hover: '#0EA372',
          muted: '#10B98122',
          foreground: '#04140D',
        },
        // Text
        foreground: '#F4F6F8',
        muted: '#9CA3AF',
        // Feedback
        danger: '#EF4444',
        warning: '#F59E0B',
        success: '#22C55E',
      },
      fontFamily: {
        // Modern geometric sans. Wire up next/font in app/layout (step 5).
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '0.875rem',
      },
    },
  },
  plugins: [],
};

export default config;
