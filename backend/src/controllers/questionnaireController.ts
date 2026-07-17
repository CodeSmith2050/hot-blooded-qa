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

// ==================== 数据格式转换辅助函数 ====================

/**
 * 题型映射：前端类型 -> 后端存储类型
 * 前端使用 'single_choice'/'multiple_choice'，后端存储 'single'/'multiple'
 */
const frontendToBackendTypeMap: Record<string, string> = {
  'single_choice': 'single',
  'multiple_choice': 'multiple',
  'text': 'text',
  'rating': 'rating',
  'date': 'text',
  'single': 'single',
  'multiple': 'multiple',
};

/**
 * 题型映射：后端存储类型 -> 前端类型
 *
 * E-002 矩阵题：保持 'matrix' 不降级（之前误降级为 'text'，导致前端无法识别）
 */
const backendToFrontendTypeMap: Record<string, string> = {
  'single': 'single_choice',
  'multiple': 'multiple_choice',
  'text': 'text',
  'rating': 'rating',
  'matrix': 'matrix',
};

/**
 * 将前端题目格式转换为后端存储格式
 *
 * 前端格式: { type: 'single_choice', options: [{id, text, score}, ... }
 * 后端格式: { type: 'single', options: ['选项A', '选项B'], id, order, ... }
 *
 * E-002 矩阵题：matrix 类型保留原值，并复制 matrixRows/matrixCols 字段
 */
function convertFrontendToBackendQuestions(frontendQuestions: any[]): any[] {
  if (!frontendQuestions || !Array.isArray(frontendQuestions)) return [];

  return frontendQuestions.map((q, index) => {
    const backendType = frontendToBackendTypeMap[q.type] || q.type;

    const backendQuestion: any = {
      id: q.id || `q_${Date.now()}_${index}`,
      type: backendType,
      title: q.title,
      required: q.required ?? false,
      order: q.order ?? index,
    };

    // 选项转换：对象数组或字符串数组 -> 字符串数组
    if (backendType === 'single' || backendType === 'multiple') {
      if (q.options && Array.isArray(q.options)) {
        backendQuestion.options = q.options.map((opt: any) => {
          if (typeof opt === 'string') return opt;
          if (opt && typeof opt === 'object' && opt.text) return opt.text;
          return String(opt);
        });
      }
    }

    // 评分题：最大分值
    if (backendType === 'rating') {
      backendQuestion.ratingMax = q.maxRating || q.ratingMax || 5;
    }

    // E-002 矩阵题：复制行/列定义（字符串数组直传）
    if (backendType === 'matrix') {
      if (Array.isArray(q.matrixRows)) {
        backendQuestion.matrixRows = q.matrixRows.filter((r: any) => typeof r === 'string');
      }
      if (Array.isArray(q.matrixCols)) {
        backendQuestion.matrixCols = q.matrixCols.filter((c: any) => typeof c === 'string');
      }
    }

    return backendQuestion;
  });
}

/**
 * 将后端存储格式转换为前端显示格式
 *
 * 后端格式: { type: 'single', options: ['选项A', '选项B'], ... }
 * 前端格式: { type: 'single_choice', options: [{id, text, score: 0}, ... }
 *
 * E-002 矩阵题：matrix 类型回传为 'matrix'，并复制 matrixRows/matrixCols
 */
function convertBackendToFrontendQuestions(backendQuestions: any[]): any[] {
  if (!backendQuestions || !Array.isArray(backendQuestions)) return [];

  return backendQuestions.map((q, index) => {
    const frontendType = backendToFrontendTypeMap[q.type] || q.type;

    const frontendQuestion: any = {
      id: q.id || `q_${index}`,
      type: frontendType,
      title: q.title,
      required: q.required ?? false,
    };

    // 选项转换：字符串数组 -> 对象数组
    if (q.type === 'single' || q.type === 'multiple' || q.type === 'single_choice' || q.type === 'multiple_choice') {
      if (q.options && Array.isArray(q.options)) {
        frontendQuestion.options = q.options.map((opt: any, optIndex: number) => {
          if (typeof opt === 'string') {
            return { id: `opt_${index}_${optIndex}`, text: opt, score: 0 };
          }
          if (opt && typeof opt === 'object') {
            return {
              id: opt.id || `opt_${index}_${optIndex}`, text: opt.text || String(opt), score: opt.score || 0 };
          }
          return { id: `opt_${index}_${optIndex}`, text: String(opt), score: 0 };
        });
      }
    }

    // 评分题
    if (q.type === 'rating') {
      frontendQuestion.maxRating = q.ratingMax || 5;
    }

    // E-002 矩阵题：回传行/列定义
    if (q.type === 'matrix') {
      frontendQuestion.matrixRows = Array.isArray(q.matrixRows) ? [...q.matrixRows] : [];
      frontendQuestion.matrixCols = Array.isArray(q.matrixCols) ? [...q.matrixCols] : [];
    }

    return frontendQuestion;
  });
}

/**
 * 将后端问卷对象转换为前端显示格式
 */
function convertBackendToFrontendQuestionnaire(questionnaire: any): any {
  const obj = questionnaire.toObject ? questionnaire.toObject() : questionnaire;
  return {
    ...obj,
    questions: convertBackendToFrontendQuestions(obj.questions),
  };
}

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
      data: questionnaires.map(q => convertBackendToFrontendQuestionnaire(q)),
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
      data: convertBackendToFrontendQuestionnaire(questionnaire)
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

    // 创建新问卷（转换题目格式为后端存储格式）
    const questionnaire = new Questionnaire({
      title,
      description,
      questions: convertFrontendToBackendQuestions(questions),
      createdBy: req.userId,  // 关联当前用户
      status: 'draft'         // 默认草稿状态
    });

    await questionnaire.save();

    res.status(201).json({
      success: true,
      message: '问卷创建成功',
      data: convertBackendToFrontendQuestionnaire(questionnaire)
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
    if (questions) questionnaire.questions = convertFrontendToBackendQuestions(questions);

    await questionnaire.save();

    res.json({
      success: true,
      message: '问卷更新成功',
      data: convertBackendToFrontendQuestionnaire(questionnaire)
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
      data: convertBackendToFrontendQuestionnaire(questionnaire)
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
 * 导入问卷
 * 
 * 请求方法：POST
 * 请求路径：/api/questionnaires/import
 * 请求体：{ title, description?, questions }
 * 
 * 功能：
 * - 支持批量导入问卷JSON数据
 * - 验证问卷格式
 * - 自动创建问卷并返回结果
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function importQuestionnaire(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { title, description, questions } = req.body;

    // 验证必填字段
    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({
        success: false,
        message: '问卷标题不能为空'
      });
      return;
    }

    // 验证题目格式
    if (!questions || !Array.isArray(questions)) {
      res.status(400).json({
        success: false,
        message: '问卷题目格式错误，questions必须是数组'
      });
      return;
    }

    // 题型映射（用于验证）— E-002 追加 matrix
    const validTypes = ['single_choice', 'multiple_choice', 'text', 'rating', 'date', 'single', 'multiple', 'matrix'];

    // 验证每个题目
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.type || !validTypes.includes(q.type)) {
        res.status(400).json({
          success: false,
          message: `第 ${i + 1} 题：题目类型无效`
        });
        return;
      }
      
      if (!q.title || typeof q.title !== 'string' || q.title.trim() === '') {
        res.status(400).json({
          success: false,
          message: `第 ${i + 1} 题：题目标题不能为空`
        });
        return;
      }

      // 选择题必须有效选项
      const isChoiceType = q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'single' || q.type === 'multiple';
      if (isChoiceType) {
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
          res.status(400).json({
            success: false,
            message: `第 ${i + 1} 题：选择题至少需要2个选项`
          });
          return;
        }
        
        // 验证选项格式（支持两种格式：字符串或对象）
        for (let j = 0; j < q.options.length; j++) {
          const opt = q.options[j];
          if (typeof opt === 'string') continue;
          if (!opt.text || typeof opt.text !== 'string') {
            res.status(400).json({
              success: false,
              message: `第 ${i + 1} 题：第 ${j + 1} 个选项文本无效`
            });
            return;
          }
        }
      }
    }

    // 创建问卷（使用共享转换函数）
    const questionnaire = new Questionnaire({
      title: title.trim(),
      description: description?.trim() || '',
      questions: convertFrontendToBackendQuestions(questions),
      createdBy: req.userId,
      status: 'draft'
    });

    await questionnaire.save();

    res.status(201).json({
      success: true,
      message: '问卷导入成功',
      data: convertBackendToFrontendQuestionnaire(questionnaire)
    });

  } catch (error) {
    console.error('导入问卷失败:', error);
    res.status(500).json({
      success: false,
      message: '导入问卷失败',
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
      data: convertBackendToFrontendQuestionnaire(questionnaire)
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