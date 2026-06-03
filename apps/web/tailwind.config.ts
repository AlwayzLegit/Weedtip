import type { Config } from 'tailwindcss';

/**
 * Weedtip brand theme — premium dark with a green accent. "The Google Maps of
 * cannabis." Tokens here are the single source for the web UI; mirror in the
 * Flutter theme. The palette layers surfaces (background → surface → surface-2
 * → surface-3) and pairs soft elevation shadows with a green "glow" for emphasis.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces (low → high elevation)
        background: '#0B0D12',
        surface: '#161922',
        'surface-2': '#1F232E',
        'surface-3': '#272C39',
        border: '#2A2F3C',
        'border-strong': '#3A4150',
        // Brand green
        primary: {
          DEFAULT: '#10B981',
          hover: '#0EA372',
          muted: '#10B98118',
          subtle: '#10B98110',
          foreground: '#04140D',
        },
        // Text
        foreground: '#F4F6F8',
        muted: '#9AA3B2',
        'muted-foreground': '#6B7280',
        // Feedback
        danger: '#EF4444',
        warning: '#F59E0B',
        success: '#22C55E',
        ring: '#10B981',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.40), 0 6px 20px -10px rgba(0,0,0,0.55)',
        'card-hover': '0 2px 6px 0 rgba(0,0,0,0.45), 0 18px 44px -16px rgba(0,0,0,0.70)',
        glow: '0 10px 34px -12px rgba(16,185,129,0.45)',
        'glow-sm': '0 0 0 1px rgba(16,185,129,0.30), 0 4px 16px -6px rgba(16,185,129,0.35)',
        'inner-top': 'inset 0 1px 0 0 rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(60% 55% at 50% -5%, rgba(16,185,129,0.18), transparent 70%)',
        'surface-sheen': 'linear-gradient(180deg, rgba(255,255,255,0.035), transparent 40%)',
        'primary-grad': 'linear-gradient(135deg, #10B981 0%, #0EA372 100%)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease both',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
