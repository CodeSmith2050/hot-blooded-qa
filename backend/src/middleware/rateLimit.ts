/**
 * 限流中间件 (Rate Limit Middleware)
 *
 * 功能说明：
 * - 实现简单的内存固定窗口限流（Fixed Window）
 * - 适用于单实例部署；多实例部署需替换为 Redis 共享存储
 * - 通过 X-RateLimit-* 响应头返回限流信息，符合业界惯例
 *
 * 设计取舍：
 * - 选择自实现而非引入 express-rate-limit，避免新增依赖
 * - 业务场景明确：仅对公开提交接口做限流防刷，无需复杂算法
 * - 限流记录定期清理，避免内存泄漏
 *
 * 使用方式：
 *   import { rateLimit } from '../middleware/rateLimit';
 *   const limiter = rateLimit({ windowMs: 60_000, max: 5 });
 *   router.post('/submit', limiter, submitAnswer);
 */

import { Request, Response, NextFunction } from 'express';

/**
 * 限流配置
 */
export interface RateLimitOptions {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 窗口内最大请求数 */
  max: number;
  /** 超出限制时的错误消息 */
  message?: string;
  /** 自定义限流键生成器（默认使用 req.ip） */
  keyGenerator?: (req: Request) => string;
  /** 是否跳过限流（如对内网测试环境放行） */
  skip?: (req: Request) => boolean;
}

/**
 * 单条限流记录
 */
interface RateLimitRecord {
  count: number;       // 当前窗口已发生请求数
  resetAt: number;     // 窗口重置时间戳（毫秒）
}

/**
 * 创建限流中间件
 *
 * @param options 限流配置
 */
export function rateLimit(options: RateLimitOptions) {
  const hits = new Map<string, RateLimitRecord>();

  // 定期清理过期记录，避免 Map 无限增长
  // .unref() 确保定时器不会阻止进程退出
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits) {
      if (record.resetAt < now) {
        hits.delete(key);
      }
    }
  }, options.windowMs);
  cleanup.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // 跳过逻辑
    if (options.skip && options.skip(req)) {
      next();
      return;
    }

    // 生成限流键
    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.ip || 'unknown');

    const now = Date.now();
    let record = hits.get(key);

    // 首次请求或窗口已过期，初始化记录
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + options.windowMs };
      hits.set(key, record);
    }

    record.count++;

    // 设置标准限流响应头，便于客户端感知配额
    const remaining = Math.max(0, options.max - record.count);
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', record.resetAt);

    // 超出限制：返回 429 Too Many Requests
    if (record.count > options.max) {
      // Retry-After 头：建议客户端多少秒后重试
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      res.status(429).json({
        success: false,
        message: options.message || '请求过于频繁，请稍后再试'
      });
      return;
    }

    next();
  };
}
