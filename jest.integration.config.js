/* eslint-disable */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '<rootDir>/src/**/__integration__/**/*.test.ts',
    '<rootDir>/src/**/*.integration.test.ts'
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
  setupFilesAfterEnv: ['<rootDir>/src/__integration__/setup.integration.ts'],
  testTimeout: 60000,
  // CI環境では統合テストをスキップ
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  // 環境変数でスキップ制御
  testEnvironmentOptions: {
    SKIP_INTEGRATION_TESTS: process.env.CI === 'true' ? 'true' : 'false'
  }
}; 