import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-plugin-prettier/recommended';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // 1. TÄRKEÄÄ: Ohitetaan raskaat build- ja välimuistikansiot heti alussa
  {
    ignores: ['node_modules/**', '.expo/**', '.next/**', 'dist/**', 'build/**', 'web-build/**'],
  },

  // 2. Käännetään vanhanmallinen 'eslint-config-expo' uuteen muotoon
  ...compat.extends('expo'),

  // 3. Tuodaan Prettier mukaan
  prettier,

  // Service worker and Node scripts — different environments
  {
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        clients: 'readonly',
      },
    },
  },
  {
    files: ['scripts/**/*.js', 'scripts/**/*.cjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly', // Lisätty varmuuden vuoksi myös tämä Node-globaali
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        exports: 'readonly', // Lisätty valmius CommonJS exporteille
      },
    },
  },

  // 4. Sinun omat säännöt, parserit ja IndexedDB-muuttujat
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      globals: {
        window: 'readonly',
        navigator: 'readonly',
        indexedDB: 'readonly',
        IDBKeyRange: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn'],
    },
  },
];
