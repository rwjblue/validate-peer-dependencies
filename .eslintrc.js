'use strict';

module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:node/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: ['prettier', 'node'],
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'script',
  },
  env: {
    node: true,
  },
  overrides: [
    {
      files: ['jest.setup.js', '**/*.test.js'],
      env: {
        jest: true,
      },
    },
  ],
};
