import { Router } from 'express';
import {
  submitAnswer,
  getAnswers,
  getAnswerDetail,
  getStatistics,
  exportAnswers,
} from '../controllers/answerController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 公开路由 - 提交答案（无需认证）
router.post('/submit', submitAnswer);

// 需要认证的路由
// 注意：静态路径（如 /statistics、/:id/export）必须定义在参数路径
// (/:questionnaireId、/:questionnaireId/:answerId) 之前，否则 Express 按顺序
// 匹配时会将静态段误当作参数，导致路由不可达。详见 BUG-001。
router.get('/statistics/:questionnaireId', authMiddleware, getStatistics);
router.get('/:questionnaireId/export', authMiddleware, exportAnswers);
router.get('/:questionnaireId', authMiddleware, getAnswers);
router.get('/:questionnaireId/:answerId', authMiddleware, getAnswerDetail);

export default router;