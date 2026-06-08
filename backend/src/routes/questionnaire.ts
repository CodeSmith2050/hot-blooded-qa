import { Router } from 'express';
import {
  getQuestionnaires,
  getQuestionnaire,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  publishQuestionnaire,
  closeQuestionnaire,
  importQuestionnaire,
} from '../controllers/questionnaireController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 公开路由 - 获取已发布的问卷（无需认证）
router.get('/public/:id', getQuestionnaire);

// 需要认证的路由
router.get('/', authMiddleware, getQuestionnaires);
router.get('/:id', authMiddleware, getQuestionnaire);
router.post('/', authMiddleware, createQuestionnaire);
router.post('/import', authMiddleware, importQuestionnaire);
router.put('/:id', authMiddleware, updateQuestionnaire);
router.delete('/:id', authMiddleware, deleteQuestionnaire);
router.post('/:id/publish', authMiddleware, publishQuestionnaire);
router.post('/:id/close', authMiddleware, closeQuestionnaire);

export default router;