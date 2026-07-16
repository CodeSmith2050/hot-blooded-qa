/**
 * Jest 全局 Teardown（仅在整个测试运行结束时执行一次）
 *
 * 功能说明：
 * - 停止 mongodb-memory-server 实例
 * - 释放二进制进程资源
 */

/**
 * Jest globalTeardown 入口函数
 */
export default async function globalTeardown(): Promise<void> {
  const mongoServer = (globalThis as any).__MONGO_SERVER__;
  if (mongoServer) {
    await mongoServer.stop();
    console.log('✓ 测试用内存 MongoDB 已停止');
  }
}
