/**
 * 认证控制器 (Auth Controller)
 * 
 * 功能说明：
 * - 处理用户注册
 * - 处理用户登录
 * - 获取当前用户信息
 */

import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * 用户注册
 * 
 * 请求方法：POST
 * 请求路径：/api/auth/register
 * 请求体：{ username, email, password, role? }
 * 
 * 处理流程：
 * 1. 验证用户名和邮箱是否已被占用
 * 2. 创建新用户（密码会自动加密）
 * 3. 生成JWT令牌
 * 4. 返回用户信息和令牌
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    // 1. 从请求体获取参数
    const { username, email, password, role } = req.body;

    // 2. 检查用户名或邮箱是否已存在
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: '用户名或邮箱已被注册'
      });
      return;
    }

    // 3. 创建新用户
    // 注意：User模型的pre('save')中间件会自动加密密码
    const user = new User({
      username,
      email,
      password,
      role: role || 'user'  // 默认为普通用户
    });
    await user.save();

    // 4. 生成JWT令牌
    // JWT包含用户ID和角色信息
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      signOptions
    );

    // 5. 返回成功响应
    res.status(201).json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      success: false,
      message: '注册失败',
      error: process.env.NODE_ENV === 'development' 
        ? (error as Error).message 
        : undefined
    });
  }
}

/**
 * 用户登录
 * 
 * 请求方法：POST
 * 请求路径：/api/auth/login
 * 请求体：{ username, password }
 * 
 * 处理流程：
 * 1. 根据用户名查找用户
 * 2. 验证密码是否正确
 * 3. 生成JWT令牌
 * 4. 返回用户信息和令牌
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // 1. 从请求体获取参数
    const { username, password } = req.body;

    // 2. 查找用户
    // 使用select('+password')显式包含密码字段（默认不包含）
    const user = await User.findOne({ username }).select('+password');
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
      return;
    }

    // 3. 验证密码
    // 使用User模型的comparePassword方法进行比对
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
      return;
    }

    // 4. 生成JWT令牌
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      signOptions
    );

    // 5. 返回成功响应（不返回密码）
    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 获取当前用户信息
 * 
 * 请求方法：GET
 * 请求路径：/api/auth/profile
 * 请求头：Authorization: Bearer <token>
 * 
 * 处理流程：
 * 1. 从JWT令牌中获取用户ID（由authMiddleware设置）
 * 2. 查询用户信息
 * 3. 返回用户信息
 * 
 * 注意：此接口需要认证，需先通过authMiddleware验证
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    // 1. 从请求对象获取用户ID（由authMiddleware设置）
    const userId = req.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: '未提供认证信息'
      });
      return;
    }

    // 2. 查询用户信息（排除密码字段）
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: '用户不存在'
      });
      return;
    }

    // 3. 返回用户信息
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}