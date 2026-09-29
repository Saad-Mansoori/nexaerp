/** @type {import('jest').Config} */
module.exports = {
  clearMocks: true,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@nexaerp/api/(.*)$': '<rootDir>/src/$1',
    '^@nexaerp/shared$': '<rootDir>/../../packages/shared/src',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'js', 'json'],
};
