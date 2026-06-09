/**
 * 模板路由配置 (Template Routes)
 * 
 * 路由列表：
 * - GET /api/templates - 获取模板列表
 * - GET /api/templates/:id - 获取模板详情
 * - POST /api/templates/:id/create - 基于模板创建问卷
 * - POST /api/templates/init - 初始化预设模板（管理员）
 */

import express from 'express';
import {
  getTemplates,
  getTemplate,
  createQuestionnaireFromTemplate,
  initTemplates
} from '../controllers/templateController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// 获取模板列表（公开访问）
router.get('/', getTemplates);

// 获取模板详情（公开访问）
router.get('/:id', getTemplate);

// 基于模板创建问卷（需要登录）
router.post('/:id/create', authMiddleware, createQuestionnaireFromTemplate);

// 初始化预设模板（需要登录）
router.post('/init', authMiddleware, initTemplates);

export default router;