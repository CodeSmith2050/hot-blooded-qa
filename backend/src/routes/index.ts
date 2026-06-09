import { Router } from 'express';
import authRoutes from './auth';
import questionnaireRoutes from './questionnaire';
import answerRoutes from './answer';
import templateRoutes from './template';

const router = Router();

// 认证路由
router.use('/auth', authRoutes);

// 问卷路由
router.use('/questionnaires', questionnaireRoutes);

// 答案路由
router.use('/answers', answerRoutes);

// 模板路由
router.use('/templates', templateRoutes);

export default router;