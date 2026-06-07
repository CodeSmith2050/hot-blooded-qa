import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 注册
router.post('/register', register);

// 登录
router.post('/login', login);

// 获取用户信息（需要认证）
router.get('/profile', authMiddleware, getProfile);

export default router;