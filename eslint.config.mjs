// Root flat ESLint config (ESLint 9+).
// App/package-level configs extend this via `import baseConfig from '../../eslint.config.mjs'`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/out/**',
      '**/build/**',
      'apps/mobile/**',
      '**/next-env.d.ts',
      'packages/supabase/src/types/database.types.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Operational Node scripts (run with `node`, not bundled) — give them the
    // Node globals that js.configs.recommended's no-undef otherwise flags.
    files: ['**/scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
);
