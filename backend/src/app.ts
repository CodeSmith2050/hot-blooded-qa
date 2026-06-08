/**
 * Express 应用入口文件
 * 
 * 功能说明：
 * - 配置所有中间件（安全、跨域、日志、压缩等）
 * - 注册路由
 * - 处理404和错误响应
 * 
 * 中间件执行顺序： helmet -> cors -> compression -> morgan -> json/urlencoded -> routes
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import routes from './routes';

// 创建 Express 应用实例
const app = express();

// ==================== 中间件配置 ====================

/**
 * helmet：安全头中间件
 * 自动设置多种HTTP安全头，防止常见Web攻击
 * 包括：XSS过滤、-frame点击劫持防护、内容类型嗅探等
 */
app.use(helmet());

/**
 * cors：跨域资源共享
 * 允许前端应用跨域访问后端API
 * 生产环境建议配置具体的允许域名列表
 */
app.use(cors());

/**
 * compression：响应压缩
 * 自动压缩响应数据，减少网络传输量
 * 支持 gzip、deflate 等压缩算法
 */
app.use(compression());

/**
 * morgan：HTTP请求日志
 * 'dev' 格式：显示请求方法、路径、状态码、响应时间
 * 便于开发调试和日志追踪
 */
app.use(morgan('dev'));

/**
 * express.json：JSON请求体解析
 * 解析 Content-Type 为 application/json 的请求
 * 限制请求体大小为 10mb，防止大文件攻击
 */
app.use(express.json({ limit: '10mb' }));

/**
 * express.urlencoded：URL编码解析
 * 解析 application/x-www-form-urlencoded 格式的请求
 * extended: true 允许解析嵌套对象
 */
app.use(express.urlencoded({ extended: true }));

// ==================== 路由配置 ====================

/**
 * API路由注册
 * 所有API接口都以 /api 前缀开始
 */
app.use('/api', routes);

// ==================== 健康检查接口 ====================

/**
 * GET /health
 * 用于负载均衡器或监控服务检查服务健康状态
 * 返回服务状态和当前时间戳
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime() // 服务运行时间（秒）
  });
});

// ==================== 错误处理 ====================

/**
 * 404处理
 * 当请求的路由不存在时触发
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: '路由不存在',
    path: req.path,
    method: req.method
  });
});

/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误，统一返回500响应
 * 避免将内部错误信息暴露给客户端
 * 
 * @param err - 错误对象
 * @param req - 请求对象
 * @param res - 响应对象
 * @param next - 下一个中间件函数
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // 记录错误日志到控制台
  console.error('========== 错误信息 ==========');
  console.error(`时间: ${new Date().toISOString()}`);
  console.error(`路径: ${req.method} ${req.path}`);
  console.error(`错误: ${err.message}`);
  console.error(`堆栈: ${err.stack}`);
  console.error('===============================');

  // 返回通用错误信息，不暴露内部细节
  res.status(500).json({
    message: '服务器内部错误',
    // 仅在开发环境返回详细错误信息
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export default app;
