/**
 * 问卷控制器 (Questionnaire Controller)
 * 
 * 功能说明：
 * - 问卷列表查询（分页、筛选）
 * - 问卷创建、编辑、删除
 * - 问卷发布与关闭
 */

import { Request, Response } from 'express';
import { Questionnaire } from '../models/Questionnaire';

/**
 * 获取问卷列表
 * 
 * 请求方法：GET
 * 请求路径：/api/questionnaires
 * 查询参数：
 *   - status: 问卷状态（draft/published/closed）
 *   - search: 搜索关键词（匹配标题）
 *   - page: 页码（默认1）
 *   - limit: 每页数量（默认10）
 * 
 * 处理流程：
 * 1. 构建查询条件
 * 2. 执行分页查询
 * 3. 返回问卷列表和分页信息
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getQuestionnaires(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // 1. 从查询参数获取过滤条件
    const { status, search, page = 1, limit = 10 } = req.query;
    
    // 2. 构建MongoDB查询条件
    // 只查询当前用户创建的问卷
    const query: Record<string, any> = { createdBy: req.userId };
    
    // 按状态筛选
    if (status) {
      query.status = status;
    }
    
    // 按关键词搜索（模糊匹配标题）
    if (search) {
      query.title = { $regex: search as string, $options: 'i' };
      // $regex: 正则表达式
      // $options: 'i' 表示不区分大小写
    }

    // 3. 执行查询
    // countDocuments: 计数（不返回数据，用于分页）
    const total = await Questionnaire.countDocuments(query);
    
    // find: 返回匹配的文档
    // sort: 排序（按创建时间降序）
    // skip: 跳过前N条（用于分页）
    // limit: 限制返回数量
    const questionnaires = await Questionnaire.find(query)
      .sort({ createdAt: -1 })  // -1 表示降序
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    // 4. 返回响应
    res.json({
      success: true,
      questionnaires,
      pagination: {
        total,                      // 总记录数
        page: Number(page),         // 当前页码
        limit: Number(limit),       // 每页数量
        totalPages: Math.ceil(total / Number(limit))  // 总页数
      }
    });

  } catch (error) {
    console.error('获取问卷列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取问卷列表失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 获取单个问卷详情
 * 
 * 请求方法：GET
 * 请求路径：/api/questionnaires/:id
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getQuestionnaire(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    
    const questionnaire = await Questionnaire.findById(id);

    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    res.json({
      success: true,
      questionnaire
    });

  } catch (error) {
    console.error('获取问卷详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取问卷详情失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 创建问卷
 * 
 * 请求方法：POST
 * 请求路径：/api/questionnaires
 * 请求体：{ title, description?, questions }
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function createQuestionnaire(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { title, description, questions } = req.body;

    // 创建新问卷
    const questionnaire = new Questionnaire({
      title,
      description,
      questions,
      createdBy: req.userId,  // 关联当前用户
      status: 'draft'         // 默认草稿状态
    });

    await questionnaire.save();

    res.status(201).json({
      success: true,
      message: '问卷创建成功',
      questionnaire
    });

  } catch (error) {
    console.error('创建问卷失败:', error);
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
 * 更新问卷
 * 
 * 请求方法：PUT
 * 请求路径：/api/questionnaires/:id
 * 请求体：{ title?, description?, questions? }
 * 
 * 限制：只有草稿状态的问卷才能编辑
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function updateQuestionnaire(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { title, description, questions } = req.body;

    // 查找问卷
    const questionnaire = await Questionnaire.findById(id);
    
    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    // 检查状态：只有草稿状态才能编辑
    if (questionnaire.status !== 'draft') {
      res.status(400).json({
        success: false,
        message: '只有草稿状态的问卷才能编辑'
      });
      return;
    }

    // 更新字段
    if (title) questionnaire.title = title;
    if (description !== undefined) questionnaire.description = description;
    if (questions) questionnaire.questions = questions;

    await questionnaire.save();

    res.json({
      success: true,
      message: '问卷更新成功',
      questionnaire
    });

  } catch (error) {
    console.error('更新问卷失败:', error);
    res.status(500).json({
      success: false,
      message: '更新问卷失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 删除问卷
 * 
 * 请求方法：DELETE
 * 请求路径：/api/questionnaires/:id
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function deleteQuestionnaire(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const questionnaire = await Questionnaire.findById(id);
    
    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    // 使用deleteOne删除文档
    await questionnaire.deleteOne();

    res.json({
      success: true,
      message: '问卷删除成功'
    });

  } catch (error) {
    console.error('删除问卷失败:', error);
    res.status(500).json({
      success: false,
      message: '删除问卷失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 发布问卷
 * 
 * 请求方法：POST
 * 请求路径：/api/questionnaires/:id/publish
 * 
 * 限制：只有草稿状态的问卷才能发布
 * 效果：发布后问卷状态变为'published'，可被用户填写
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function publishQuestionnaire(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const questionnaire = await Questionnaire.findById(id);
    
    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    // 检查状态
    if (questionnaire.status !== 'draft') {
      res.status(400).json({
        success: false,
        message: '只有草稿状态的问卷才能发布'
      });
      return;
    }

    // 更新状态和发布时间
    questionnaire.status = 'published';
    questionnaire.publishedAt = new Date();
    await questionnaire.save();

    res.json({
      success: true,
      message: '问卷发布成功',
      questionnaire
    });

  } catch (error) {
    console.error('发布问卷失败:', error);
    res.status(500).json({
      success: false,
      message: '发布问卷失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 关闭问卷
 * 
 * 请求方法：POST
 * 请求路径：/api/questionnaires/:id/close
 * 
 * 限制：只有已发布状态的问卷才能关闭
 * 效果：关闭后问卷状态变为'closed'，停止收集新答案
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function closeQuestionnaire(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const questionnaire = await Questionnaire.findById(id);
    
    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    // 检查状态：只有已发布才能关闭
    if (questionnaire.status !== 'published') {
      res.status(400).json({
        success: false,
        message: '只有已发布的问卷才能关闭'
      });
      return;
    }

    // 更新状态和关闭时间
    questionnaire.status = 'closed';
    questionnaire.closedAt = new Date();
    await questionnaire.save();

    res.json({
      success: true,
      message: '问卷关闭成功',
      questionnaire
    });

  } catch (error) {
    console.error('关闭问卷失败:', error);
    res.status(500).json({
      success: false,
      message: '关闭问卷失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}