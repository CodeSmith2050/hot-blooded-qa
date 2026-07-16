/**
 * Jest 测试框架配置
 *
 * 功能说明：
 * - 使用 ts-jest 处理 TypeScript 测试文件
 * - 配置测试环境为 Node
 * - 设置测试文件匹配规则
 * - 配置测试覆盖率收集范围
 */

module.exports = {
  // 预设：使用 ts-jest 处理 TypeScript
  preset: 'ts-jest',

  // 测试环境：Node.js（非浏览器环境）
  testEnvironment: 'node',

  // 全局 Setup/Teardown：管理内存 MongoDB 生命周期（整个测试运行只执行一次）
  globalSetup: '<rootDir>/test/globalSetup.ts',
  globalTeardown: '<rootDir>/test/globalTeardown.ts',

  // 测试文件匹配规则
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
  ],

  // 模块路径别名（与 tsconfig.json 保持一致）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // 测试 setup 文件（每个测试文件执行前运行）
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // 超时时间（毫秒），内存 MongoDB 启动较慢，给予充足时间
  testTimeout: 30000,

  // 覆盖率配置
  collectCoverageFrom: [
    'src/controllers/**/*.ts',
    'src/middleware/**/*.ts',
    'src/models/**/*.ts',
    '!src/**/*.d.ts',
  ],

  // 覆盖率输出目录
  coverageDirectory: '<rootDir>/test/coverage',

  // 详细输出
  verbose: true,
};
