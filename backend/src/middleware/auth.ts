/**
 * JWT认证中间件
 * 
 * 功能说明：
 * - 验证请求头中的JWT令牌
 * - 提取用户信息并附加到请求对象
 * - 支持令牌过期检查
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT密钥（应与authController中保持一致）
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

/**
 * 扩展Express Request接口
 * 添加自定义属性userId和userRole
 * 这些属性由authMiddleware设置
 */
declare global {
  namespace Express {
    interface Request {
      /**
       * 当前登录用户的ID
       * 从JWT payload中提取
       */
      userId?: string;
      
      /**
       * 当前登录用户的角色
       * 从JWT payload中提取
       */
      userRole?: string;
    }
  }
}

/**
 * JWT认证中间件
 * 
 * 功能：
 * - 从Authorization请求头中提取JWT令牌
 * - 验证令牌的有效性
 * - 将用户ID和角色附加到请求对象
 * 
 * 请求头格式：Authorization: Bearer <token>
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 * @param next - 下一个中间件函数
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // 1. 获取Authorization请求头
    const authHeader = req.headers.authorization;
    
    // 2. 检查是否提供了令牌
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
      return;
    }

    // 3. 检查令牌格式（必须是Bearer token格式）
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: '令牌格式错误，应为 Bearer <token>'
      });
      return;
    }

    // 4. 提取令牌（去掉"Bearer "前缀）
    const token = authHeader.split(' ')[1];

    // 5. 验证并解码令牌
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
    };

    // 6. 将用户信息附加到请求对象
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    // 7. 调用下一个中间件
    next();

  } catch (error) {
    // 处理各种JWT错误
    
    if (error instanceof jwt.TokenExpiredError) {
      // 令牌已过期
      res.status(401).json({
        success: false,
        message: '令牌已过期，请重新登录'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      // 令牌格式错误或被篡改
      res.status(401).json({
        success: false,
        message: '无效的令牌'
      });
      return;
    }

    // 其他未知错误
    res.status(401).json({
      success: false,
      message: '认证失败'
    });
  }
}

/**
 * 管理员权限中间件
 * 
 * 功能：
 * - 检查当前用户是否为管理员
 * - 通常在authMiddleware之后使用
 * 
 * 使用方式：
 * router.delete('/admin-only', authMiddleware, adminMiddleware, handler);
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 * @param next - 下一个中间件函数
 */
export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 检查用户角色
  if (req.userRole !== 'admin') {
    res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
    return;
  }
  
  next();
}