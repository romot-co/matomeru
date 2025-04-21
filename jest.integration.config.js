module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__integration__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__integration__/setup.integration.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
  },
  // WASM を読み込むのでタイムアウトを少し伸ばす
  testTimeout: 20000
}; 