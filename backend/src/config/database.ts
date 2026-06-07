/**
 * MongoDB 数据库连接配置
 * 
 * 功能说明：
 * - 建立与MongoDB的连接
 * - 监听连接事件（断开、错误）
 * - 实现优雅关闭
 */

import mongoose from 'mongoose';

// MongoDB 连接字符串
// 优先级：环境变量 > 默认本地地址
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hot-blooded-qa';

/**
 * 连接 MongoDB 数据库
 * 
 * @returns Promise<void> - 连接成功时resolve，失败时reject
 * 
 * 连接流程：
 * 1. 调用mongoose.connect建立连接
 * 2. 成功时打印连接信息（主机、端口、数据库名）
 * 3. 失败时捕获错误并向上抛出
 * 
 * 注意：
 * - mongoose会自动维护连接池
 * - 默认连接池大小为100
 * - 自动重连机制已内置
 */
export async function connectDatabase(): Promise<void> {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    
    // 打印连接成功信息
    console.log(`MongoDB 连接成功 ✓`);
    console.log(`  - 主机: ${conn.connection.host}`);
    console.log(`  - 端口: ${conn.connection.port}`);
    console.log(`  - 数据库: ${conn.connection.name}`);
    
  } catch (error) {
    console.error('MongoDB 连接失败 ✗');
    console.error(`  - 错误: ${(error as Error).message}`);
    console.error('  - 提示: 请确认MongoDB服务已启动');
    throw error;
  }
}

// ==================== 连接事件监听 ====================

/**
 * 连接断开事件
 * 触发时机：网络断开、服务器主动关闭连接等
 * 
 * 处理方式：仅打印日志
 * 实际生产环境应实现自动重连逻辑
 */
mongoose.connection.on('disconnected', () => {
  console.warn('⚠ MongoDB 连接已断开');
});

/**
 * 连接错误事件
 * 触发时机：连接过程中发生错误
 * 
 * 处理方式：记录错误日志
 * 
 * @param err - 错误对象
 */
mongoose.connection.on('error', (err) => {
  console.error('⚠ MongoDB 连接发生错误:', err.message);
});

// ==================== 优雅关闭处理 ====================

/**
 * 监听 SIGINT 信号（Ctrl+C 终止进程）
 * 
 * 关闭流程：
 * 1. 关闭MongoDB连接（等待正在进行的操作完成）
 * 2. 打印关闭信息
 * 3. 正常退出进程（退出码0）
 * 
 * 目的：确保数据库连接被正确关闭
 *      避免留下orphaned连接或数据不一致
 */
process.on('SIGINT', async () => {
  console.log('\n正在关闭MongoDB连接...');
  
  try {
    await mongoose.connection.close();
    console.log('MongoDB 连接已正确关闭 ✓');
  } catch (error) {
    console.error('关闭MongoDB连接时出错:', (error as Error).message);
  }
  
  // 正常退出进程
  process.exit(0);
});

/**
 * 监听 SIGTERM 信号（容器/服务管理器终止进程）
 * 
 * 与SIGINT的区别：
 * - SIGINT：用户主动Ctrl+C
 * - SIGTERM：系统发送的终止信号（如Kubernetes、docker stop）
 * 
 * 处理方式与SIGINT相同
 */
process.on('SIGTERM', async () => {
  console.log('\n收到终止信号，正在关闭MongoDB连接...');
  
  try {
    await mongoose.connection.close();
    console.log('MongoDB 连接已正确关闭 ✓');
  } catch (error) {
    console.error('关闭MongoDB连接时出错:', (error as Error).message);
  }
  
  process.exit(0);
});