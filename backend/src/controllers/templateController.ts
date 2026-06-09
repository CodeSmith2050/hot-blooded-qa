/**
 * 模板控制器 (Template Controller)
 * 
 * 功能说明：
 * - 获取模板列表
 * - 获取模板详情
 * - 基于模板创建问卷
 * - 初始化预设模板
 */

import { Request, Response } from 'express';
import { Template } from '../models/Template';
import { Questionnaire } from '../models/Questionnaire';
import { presetTemplates } from '../data/templates';

/**
 * 获取模板列表
 * 
 * 请求方法：GET
 * 请求路径：/api/templates
 * 查询参数：
 *   - category: 分类筛选（可选）
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getTemplates(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { category } = req.query;

    // 构建查询条件
    const query: any = {};
    if (category) {
      query.category = category;
    }

    // 查询模板列表
    const templates = await Template.find(query)
      .sort({ category: 1, createdAt: -1 });

    res.json({
      success: true,
      data: templates
    });

  } catch (error) {
    console.error('获取模板列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板列表失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 获取模板详情
 * 
 * 请求方法：GET
 * 请求路径：/api/templates/:id
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getTemplate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const template = await Template.findById(id);

    if (!template) {
      res.status(404).json({
        success: false,
        message: '模板不存在'
      });
      return;
    }

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('获取模板详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板详情失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 基于模板创建问卷
 * 
 * 请求方法：POST
 * 请求路径：/api/templates/:id/create
 * 请求体：{
 *   title?: string,      // 自定义问卷标题（可选，默认使用模板标题）
 *   description?: string // 自定义问卷描述（可选）
 * }
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function createQuestionnaireFromTemplate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // 获取当前用户ID（从JWT中间件设置的req.userId中获取）
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: '未登录或登录已过期'
      });
      return;
    }

    // 1. 查找模板
    const template = await Template.findById(id);

    if (!template) {
      res.status(404).json({
        success: false,
        message: '模板不存在'
      });
      return;
    }

    // 2. 增加模板使用次数
    template.usageCount += 1;
    await template.save();

    // 3. 创建问卷（使用模板的问题，但生成新的问题ID）
    const newQuestions = template.questions.map((q, index) => ({
      id: `q_${Date.now()}_${index}`,
      type: q.type,
      title: q.title,
      description: q.description,
      required: q.required,
      options: q.options,
      ratingMax: q.ratingMax,
      matrixRows: q.matrixRows,
      matrixCols: q.matrixCols,
      order: q.order
    }));

    const questionnaire = new Questionnaire({
      title: title || template.title,
      description: description || template.description,
      questions: newQuestions,
      status: 'draft',
      createdBy: userId
    });

    await questionnaire.save();

    res.status(201).json({
      success: true,
      message: '问卷创建成功',
      data: questionnaire
    });

  } catch (error) {
    console.error('基于模板创建问卷失败:', error);
    res.status(500).json({
      success: false,
      message: '创建问卷失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 初始化预设模板（仅管理员可用）
 * 
 * 请求方法：POST
 * 请求路径：/api/templates/init
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function initTemplates(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // 检查是否已存在预设模板
    const existingCount = await Template.countDocuments({ isSystem: true });
    
    if (existingCount > 0) {
      res.json({
        success: true,
        message: '预设模板已存在',
        count: existingCount
      });
      return;
    }

    // 批量创建预设模板
    const templates = presetTemplates.map(template => ({
      ...template,
      isSystem: true,
      usageCount: 0
    }));

    const createdTemplates = await Template.insertMany(templates);

    res.json({
      success: true,
      message: `成功初始化 ${createdTemplates.length} 个预设模板`,
      count: createdTemplates.length
    });

  } catch (error) {
    console.error('初始化预设模板失败:', error);
    res.status(500).json({
      success: false,
      message: '初始化模板失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}