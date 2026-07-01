import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // Not ours / not source: build output and the vendored OAuth utils.
  { ignores: ['.wrangler/**', 'dist/**', 'src/auth/workers-oauth-utils.ts'] },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    // strictTypeChecked = the strict tier + type-aware rules (includes
    // no-floating-promises, no-misused-promises, and the no-unsafe-* family
    // that guards `any` crossing trust boundaries).
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Declaration files use empty interfaces for module augmentation / merging.
  {
    files: ['**/*.d.ts'],
    rules: { '@typescript-eslint/no-empty-object-type': 'off' },
  },
  // Tests use the vitest-pool-workers `env`/`SELF` globals from 'cloudflare:test'.
  // The pool's types mark them deprecated in favour of an evolving replacement,
  // but they remain the documented test API — don't fail CI on harness churn.
  {
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-deprecated': 'off' },
  },
  // Must be last: turn off rules that would conflict with Prettier's formatting.
  prettier,
);
