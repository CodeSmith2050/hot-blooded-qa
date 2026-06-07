import { Router } from 'express';
import { submitAnswer, getAnswers, getAnswerDetail, getStatistics } from '../controllers/answerController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 公开路由 - 提交答案（无需认证）
router.post('/submit', submitAnswer);

// 需要认证的路由
router.get('/:questionnaireId', authMiddleware, getAnswers);
router.get('/:questionnaireId/:answerId', authMiddleware, getAnswerDetail);
router.get('/statistics/:questionnaireId', authMiddleware, getStatistics);

export default router;