/** 前端（H5）Jest 配置：jsdom + ts-jest，仅运行 src 下的 *.spec.ts(x) */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.jest.json' },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/server/'],
  transformIgnorePatterns: ['/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/index.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageDirectory: './coverage',
  // 覆盖率门禁基线（仅在 --coverage 时生效）：当前测试仅覆盖少量模块，先建立低基线
  // 实测（2026-09）：statements 7.25 / branches 4.07 / functions 7.97 / lines 7.16
  coverageThreshold: {
    global: {
      statements: 5,
      branches: 3,
      functions: 5,
      lines: 5,
    },
  },
}
