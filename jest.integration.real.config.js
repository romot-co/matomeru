/* eslint-disable */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '<rootDir>/src/**/__integration__/**/*.real.integration.test.ts',
    '<rootDir>/src/**/*.real.integration.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.integration.test.ts',
    '!src/**/__tests__/**',
    '!src/**/__integration__/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__integration__/setup.integration.real.ts'],
  testTimeout: 60000,
  testEnvironmentOptions: {
    SKIP_INTEGRATION_TESTS: process.env.CI === 'true' ? 'true' : 'false'
  }
};
