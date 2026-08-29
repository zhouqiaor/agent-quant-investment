/** Jest configuration for NestJS server (TDD, 参考 Freqtrade/Jesse CI 测试体系) */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: './coverage',
  // pnpm 下 ESM 包（@nestjs/testing、rxjs）需要被转换：仅对 .pnpm 中的这些包关闭忽略
  transformIgnorePatterns: ['node_modules/.pnpm/(?!(rxjs|@nestjs))'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    // 允许转换被选中的 node_modules ESM js 文件
    '^.+\\.[cm]?jsx?$': ['ts-jest', { tsconfig: { allowJs: true, esModuleInterop: true, target: 'ES2021', module: 'CommonJS' } }],
  },
  testTimeout: 30000,
}
