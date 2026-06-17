import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'
import noTopLevelReturn from './eslint.rules.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname)

/** Custom plugin that exposes our own rules. */
const customPlugin = {
  name: 'custom',
  meta: { name: 'custom', version: '1.0.0' },
  rules: { 'no-top-level-return': noTopLevelReturn },
}

export default tseslint.config(
  { ignores: ['node_modules/', 'dist/'] },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript + stylistic
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  // React hooks (errors only)
  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // React
  {
    plugins: { react },
    settings: { react: { version: '18.3' } },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...react.configs.recommended.rules,
      // React 17+ new JSX transform — no need for React import
      'react/react-in-jsx-scope': 'off',
      // Allow standard "set state in effect" pattern used throughout the codebase
      'react-hooks/set-state-in-effect': 'off',
      // TranslatableText intentionally omits doTranslate from effect deps (it reads
      // via ref, so stale closures are not a concern — see the comment in the file)
      'react-hooks/exhaustive-deps': 'off',
      // Allow unescaped quotes in JSX (pre-existing, not our focus)
      'react/no-unescaped-entities': 'off',
    },
  },

  // Custom rules
  {
    plugins: { custom: customPlugin },
    rules: {
      // THE key rule: catch "return" at file/top level — the bug that cost us
      // 3 debug sessions and 4 commits today because function bodies were
      // missing their opening brace `{`.
      'custom/no-top-level-return': 'error',
    },
  },

  // Per-file TypeScript rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json',
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      // Relaxed rules — the goal is only to catch the "return outside function"
      // bug in new edits, not to retroactively lint the entire codebase.
      // Tighten these rules over time.
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-unused-vars': 'off',
    },
  },
)