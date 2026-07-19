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
import { authMiddleware, requireRoles } from '../middleware/auth';

const router = Router();

// 公开路由 - 获取已发布的问卷（无需认证）
router.get('/public/:id', getQuestionnaire);

// U-006 角色权限：
//   - admin / analyst / editor 均可读取问卷列表与详情
//   - admin / editor 可创建、编辑、删除、发布、关闭、导入问卷
//   - analyst 为只读角色，无写权限
//
// 注意：路由顺序需保持 /import 在 /:id 之前，避免 "import" 被当作 id 参数
router.get('/', authMiddleware, requireRoles('admin', 'analyst', 'editor'), getQuestionnaires);
router.get('/:id', authMiddleware, requireRoles('admin', 'analyst', 'editor'), getQuestionnaire);
router.post('/', authMiddleware, requireRoles('admin', 'editor'), createQuestionnaire);
router.post('/import', authMiddleware, requireRoles('admin', 'editor'), importQuestionnaire);
router.put('/:id', authMiddleware, requireRoles('admin', 'editor'), updateQuestionnaire);
router.delete('/:id', authMiddleware, requireRoles('admin', 'editor'), deleteQuestionnaire);
router.post('/:id/publish', authMiddleware, requireRoles('admin', 'editor'), publishQuestionnaire);
router.post('/:id/close', authMiddleware, requireRoles('admin', 'editor'), closeQuestionnaire);

export default router;