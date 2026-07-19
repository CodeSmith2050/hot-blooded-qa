/**
 * 微信 JS-SDK 路由
 *
 * 功能说明（F-004）：
 * - GET /api/wx/signature  获取 wx.config 所需签名（公开接口，无认证）
 *
 * 限流策略：本路由暂未单独挂载限流中间件，依赖 app.ts 全局 morgan 日志监控。
 *           若后续被滥用，可在 router.use 上挂载 rateLimit。
 */

import { Router } from 'express';
import { getSignature } from '../controllers/wxController';

const router = Router();

// GET /api/wx/signature?url=<当前页面 URL>
router.get('/signature', getSignature);

export default router;
