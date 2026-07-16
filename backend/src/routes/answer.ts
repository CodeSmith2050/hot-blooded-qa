import { Router } from 'express';
import { submitAnswer, getAnswers, getAnswerDetail, getStatistics } from '../controllers/answerController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 公开路由 - 提交答案（无需认证）
router.post('/submit', submitAnswer);

// 需要认证的路由
// 注意：静态路径（如 /statistics）必须定义在参数路径（如 /:questionnaireId）之前，
// 否则 Express 按顺序匹配时会将 'statistics' 误当作 questionnaireId 参数，
// 导致 /statistics/:questionnaireId 路由不可达。BUG-001 修复。
router.get('/statistics/:questionnaireId', authMiddleware, getStatistics);
router.get('/:questionnaireId', authMiddleware, getAnswers);
router.get('/:questionnaireId/:answerId', authMiddleware, getAnswerDetail);

export default router;