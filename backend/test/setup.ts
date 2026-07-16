/**
 * 测试公共 Setup 文件（每个测试文件执行前由 setupFilesAfterEnv 触发）
 *
 * 功能说明：
 * - 连接 mongoose 到 globalSetup 启动的内存 MongoDB
 * - 在每个测试用例前清空所有集合，保证用例隔离
 * - 在所有测试结束后断开 mongoose 连接
 * - 设置测试环境变量（JWT_SECRET 等）
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// ==================== 测试环境变量配置 ====================
// 必须在导入 app / models 之前设置，因为 database.ts 模块加载时读取此变量
// 但 setup.ts 在测试文件之前执行，此处设置已足够
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-test';
process.env.JWT_EXPIRES_IN = '1h';

// ==================== 全局变量声明 ====================
declare global {
  // eslint-disable-next-line no-var
  var __MONGO_URI__: string;
  // eslint-disable-next-line no-var
  var __MONGO_DB_NAME__: string;
}

// ==================== 连接管理 ====================

/**
 * 在所有测试开始前连接到内存 MongoDB
 *
 * 说明：
 * - 优先使用 globalSetup 提供的 URI（jest 整体运行模式）
 * - 若未提供（如单独运行某个测试文件时 globalSetup 未触发），则即时启动一个内存实例
 */
let localMongoServer: MongoMemoryServer | null = null;

beforeAll(async () => {
  let uri: string;
  if (globalThis.__MONGO_URI__) {
    uri = globalThis.__MONGO_URI__;
  } else {
    // 兜底：单独运行测试文件时启动独立内存实例
    localMongoServer = await MongoMemoryServer.create();
    uri = localMongoServer.getUri();
    globalThis.__MONGO_URI__ = uri;
  }

  // 若 mongoose 未连接则建立连接
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

/**
 * 在每个测试用例前清空所有集合
 * 保证用例之间数据隔离，避免相互影响
 */
beforeEach(async () => {
  // 清空所有集合的数据，但保留集合结构（不影响 Schema）
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

/**
 * 在所有测试结束后断开 mongoose 连接
 * 若启动了兜底内存实例，一并停止
 */
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (localMongoServer) {
    await localMongoServer.stop();
  }
});
