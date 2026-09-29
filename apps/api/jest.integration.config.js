const base = require('./jest.config.js');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.int.spec.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      lines: 75,
    },
  },
};
