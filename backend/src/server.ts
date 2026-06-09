/**
 * 服务器启动入口文件
 * 
 * 功能说明：
 * - 初始化数据库连接
 * - 启动HTTP服务器
 * - 处理启动过程中的错误
 */

import app from './app';
import { connectDatabase } from './config/database';
import { Template } from './models/Template';
import { presetTemplates } from './data/templates';

// 服务器端口配置，优先使用环境变量，默认为3000
const PORT = process.env.PORT || 3000;

/**
 * 初始化预设模板数据
 */
async function initTemplates(): Promise<void> {
  try {
    const existingCount = await Template.countDocuments({ isSystem: true });
    
    if (existingCount > 0) {
      console.log(`✓ 预设模板已存在，共 ${existingCount} 个`);
      return;
    }

    const templates = presetTemplates.map(template => ({
      ...template,
      isSystem: true,
      usageCount: 0
    }));

    await Template.insertMany(templates);
    console.log(`✓ 成功初始化 ${templates.length} 个预设模板`);
  } catch (error) {
    console.error('⚠ 模板初始化失败:', (error as Error).message);
  }
}

/**
 * 启动服务器的主函数
 * 
 * 执行流程：
 * 1. 连接MongoDB数据库
 * 2. 数据库连接成功后启动HTTP服务器
 * 3. 监听指定端口
 * 
 * 错误处理：
 * - 数据库连接失败：终止进程
 * - 服务器启动失败：终止进程
 */
async function startServer(): Promise<void> {
  try {
    // 步骤1：连接MongoDB数据库
    // connectDatabase 会等待连接成功或抛出错误
    await connectDatabase();
    
    // 步骤2：初始化预设模板数据
    await initTemplates();
    
    // 步骤3：启动HTTP服务器并监听端口
    app.listen(PORT, () => {
      console.log('╔════════════════════════════════════════════════════════╗');
      console.log('║           热血问答 - 后端服务启动成功                   ║');
      console.log('╠════════════════════════════════════════════════════════╣');
      console.log(`║  服务地址:  http://localhost:${PORT}                        ║`);
      console.log(`║  健康检查:  http://localhost:${PORT}/health               ║`);
      console.log(`║  API接口:  http://localhost:${PORT}/api                  ║`);
      console.log('╚════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('提示：按 Ctrl+C 可停止服务');
    });

  } catch (error) {
    // 数据库连接失败或服务器启动失败
    console.error('╔════════════════════════════════════════════════════════╗');
    console.error('║              服务器启动失败                             ║');
    console.error('╠════════════════════════════════════════════════════════╣');
    console.error(`║  错误原因: ${(error as Error).message}       ║`);
    console.error('║                                                        ║');
    console.error('║  请检查：                                               ║');
    console.error('║  1. MongoDB服务是否已启动                              ║');
    console.error('║  2. .env文件中的MONGODB_URI是否正确                     ║');
    console.error('╚════════════════════════════════════════════════════════╝');
    
    // 退出进程，退出码1表示异常退出
    process.exit(1);
  }
}

// 启动服务器
startServer();