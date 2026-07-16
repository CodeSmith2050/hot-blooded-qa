import { Router, Request } from 'express';
import {
  submitAnswer,
  getAnswers,
  getAnswerDetail,
  getStatistics,
  getDashboard,
  exportAnswers,
} from '../controllers/answerController';
import { authMiddleware } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

/**
 * 从请求中提取客户端真实 IP（用于限流 key）
 *
 * 与 answerController.getClientIp 保持一致：
 * 优先 X-Forwarded-For 第一段，其次 X-Real-IP，最后 req.ip
 *
 * 生产环境应在 app.ts 设置 app.set('trust proxy', N) 让 req.ip 自动解析
 * X-Forwarded-For，此处显式解析是为兼容未配置 trust proxy 的场景
 */
function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && xri.length > 0) {
    return xri.trim();
  }
  return req.ip || 'unknown';
}

// S-005 限流：公开提交接口限制单 IP 每分钟最多 5 次请求
// 防止恶意刷接口；F-006 业务级防重复提交在控制器内实现
// keyGenerator 使用 X-Forwarded-For，与 controller 内 getClientIp 一致
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: '提交过于频繁，请稍后再试',
  keyGenerator: extractClientIp,
});

// 公开路由 - 提交答案（无需认证，但有限流）
router.post('/submit', submitLimiter, submitAnswer);

// 需要认证的路由
// 注意：静态路径（如 /statistics/dashboard、/statistics/:id、/:id/export）必须定义在
// 参数路径 (/:questionnaireId、/:questionnaireId/:answerId) 之前，否则 Express 按顺序
// 匹配时会将静态段误当作参数，导致路由不可达。详见 BUG-001。
// 同一前缀下，更具体的静态路径（/statistics/dashboard）须在参数路径（/statistics/:questionnaireId）之前。
router.get('/statistics/dashboard', authMiddleware, getDashboard);
router.get('/statistics/:questionnaireId', authMiddleware, getStatistics);
router.get('/:questionnaireId/export', authMiddleware, exportAnswers);
router.get('/:questionnaireId', authMiddleware, getAnswers);
router.get('/:questionnaireId/:answerId', authMiddleware, getAnswerDetail);

export default router;