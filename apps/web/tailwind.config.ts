import type { Config } from 'tailwindcss';

/**
 * Weedtip brand theme — light, minimal, and pastel-soft. "The Google Maps of
 * cannabis." Tokens here are the single source for the web UI; mirror in the
 * Flutter theme. White cards sit on a whisper-green off-white page; the brand
 * green is a deep calm emerald (not neon) with solid pastel fills for accents.
 * Guarded by lib/__tests__/contrast.test.ts.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces: the page is a softly green-tinted off-white; cards are pure
        // white (they pop via shadow + border); surface-2/3 are nested pastel
        // fills used INSIDE cards (inputs, hovers, wells) and step DOWN in
        // lightness — light-theme elevation is the inverse of the old dark ramp.
        background: '#F0F4F1',
        surface: '#FFFFFF',
        'surface-2': '#EEF2EF',
        'surface-3': '#DEE5DF',
        border: '#E3E8E4',
        'border-strong': '#C6D0C9',
        // Brand green — deep calm emerald for text/buttons (AA on white),
        // pastel solids for tinted fills.
        primary: {
          DEFAULT: '#047857',
          hover: '#065F46',
          muted: '#E7F5EE',
          subtle: '#F2FAF5',
          foreground: '#FFFFFF',
        },
        // Text — soft near-black with a green undertone (never pure black).
        foreground: '#1B2420',
        muted: '#57635C',
        'muted-foreground': '#71807A',
        // Feedback — deepened for AA on light surfaces.
        danger: '#CE2318',
        warning: '#B54708',
        success: '#12805C',
        ring: '#047857',
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
        // Light-theme elevation: soft, diffuse gray-blue shadows do the work
        // borders+lightness did on the old dark theme.
        card: '0 1px 2px 0 rgba(16,24,40,0.05), 0 6px 20px -10px rgba(16,24,40,0.08)',
        'card-hover': '0 2px 6px 0 rgba(16,24,40,0.07), 0 18px 44px -16px rgba(16,24,40,0.16)',
        glow: '0 10px 34px -12px rgba(4,120,87,0.28)',
        'glow-sm': '0 0 0 1px rgba(4,120,87,0.20), 0 4px 16px -6px rgba(4,120,87,0.20)',
        'inner-top': 'inset 0 1px 0 0 rgba(255,255,255,0.60)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(60% 55% at 50% -5%, rgba(4,120,87,0.10), transparent 70%)',
        'surface-sheen': 'linear-gradient(180deg, rgba(255,255,255,0.55), transparent 40%)',
        'primary-grad': 'linear-gradient(135deg, #059669 0%, #047857 100%)',
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
