import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 注册
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password, role } = req.body;

    // 检查用户是否已存在
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      res.status(400).json({ message: '用户名或邮箱已存在' });
      return;
    }

    // 创建用户
    const user = new User({ username, email, password, role: role || 'user' });
    await user.save();

    // 生成JWT
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, signOptions);

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: '注册失败', error: (error as Error).message });
  }
}

// 登录
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      res.status(401).json({ message: '用户名或密码错误' });
      return;
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: '用户名或密码错误' });
      return;
    }

    // 生成JWT
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, signOptions);

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: '登录失败', error: (error as Error).message });
  }
}

// 获取用户信息
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      res.status(404).json({ message: '用户不存在' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: '获取用户信息失败', error: (error as Error).message });
  }
}