/**
 * Jest 全局 Setup（仅在整个测试运行开始时执行一次）
 *
 * 功能说明：
 * - 启动 mongodb-memory-server 内存数据库实例
 * - 将内存数据库 URI 通过 globalThis 暴露给所有测试文件
 * - 避免每个测试文件重复启动数据库实例
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * 全局变量声明
 * 让 TypeScript 识别 globalThis 上的自定义属性
 */
declare global {
  // eslint-disable-next-line no-var
  var __MONGO_URI__: string;
  // eslint-disable-next-line no-var
  var __MONGO_DB_NAME__: string;
}

/**
 * Jest globalSetup 入口函数
 * 必须是异步函数，可返回 Promise
 */
export default async function globalSetup(): Promise<void> {
  // 启动内存 MongoDB 实例（二进制自动下载并运行）
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      // 使用固定数据库名，便于调试
      dbName: 'hot-blooded-qa-test',
    },
  });

  // 通过 globalThis 共享给测试文件与 setup.ts
  // jest 保证 globalSetup 与所有测试文件运行在同一进程中
  globalThis.__MONGO_URI__ = mongoServer.getUri();
  globalThis.__MONGO_DB_NAME__ = 'hot-blooded-qa-test';

  // 将实例引用挂到 globalThis，供 globalTeardown 关闭
  (globalThis as any).__MONGO_SERVER__ = mongoServer;

  console.log(`\n✓ 测试用内存 MongoDB 已启动: ${globalThis.__MONGO_URI__}`);
}
