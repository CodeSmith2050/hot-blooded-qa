/**
 * 答案控制器 (Answer Controller)
 * 
 * 功能说明：
 * - 提交问卷答案
 * - 查询答案列表
 * - 获取答案详情
 * - 统计分析
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Answer } from '../models/Answer';
import { Questionnaire } from '../models/Questionnaire';

/**
 * 提交问卷答案
 * 
 * 请求方法：POST
 * 请求路径：/api/answers/submit
 * 请求体：{
 *   questionnaireId: string,    // 问卷ID
 *   answers: AnswerValue[],     // 答案列表
 *   respondent?: IRespondent,    // 回答者信息
 *   source?: AnswerSource,      // 来源
 *   device?: DeviceType,        // 设备类型
 *   duration?: number           // 填写时长（秒）
 * }
 * 
 * 处理流程：
 * 1. 验证问卷存在且处于已发布状态
 * 2. 创建答案记录
 * 3. 返回提交成功响应
 * 
 * 注意：此接口无需认证，公众可提交
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function submitAnswer(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      questionnaireId,
      answers,
      respondent,
      source,
      device,
      duration
    } = req.body;

    // 1. 验证问卷
    const questionnaire = await Questionnaire.findById(questionnaireId);
    
    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    // 2. 检查问卷状态：只有已发布状态才能提交答案
    if (questionnaire.status !== 'published') {
      res.status(400).json({
        success: false,
        message: '该问卷未发布或已关闭'
      });
      return;
    }

    // 3. 创建答案记录
    const answer = new Answer({
      questionnaireId,
      answers,
      respondent,
      source: source || 'web',
      device: device || detectDevice(req),
      duration: duration || 0
    });

    await answer.save();

    // 4. 返回成功响应
    res.status(201).json({
      success: true,
      message: '答案提交成功',
      answerId: answer._id
    });

  } catch (error) {
    console.error('提交答案失败:', error);
    res.status(500).json({
      success: false,
      message: '提交答案失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 检测设备类型
 * 根据User-Agent判断访问设备
 * 
 * @param req - Express请求对象
 * @returns DeviceType - 设备类型
 */
function detectDevice(req: Request): 'desktop' | 'mobile' | 'tablet' {
  const userAgent = req.headers['user-agent'] || '';
  
  if (/mobile|android|iphone/i.test(userAgent)) {
    return 'mobile';
  }
  if (/tablet|ipad/i.test(userAgent)) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * 获取答案列表
 * 
 * 请求方法：GET
 * 请求路径：/api/answers/:questionnaireId
 * 查询参数：
 *   - page: 页码（默认1）
 *   - limit: 每页数量（默认20）
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getAnswers(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { questionnaireId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // 查询答案总数
    const total = await Answer.countDocuments({ questionnaireId });

    // 分页查询答案
    const answers = await Answer.find({ questionnaireId })
      .sort({ submittedAt: -1 })  // 按提交时间降序
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      success: true,
      answers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('获取答案列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取答案列表失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 获取答案详情
 * 
 * 请求方法：GET
 * 请求路径：/api/answers/:questionnaireId/:answerId
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getAnswerDetail(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { answerId } = req.params;

    const answer = await Answer.findById(answerId);

    if (!answer) {
      res.status(404).json({
        success: false,
        message: '答案不存在'
      });
      return;
    }

    res.json({
      success: true,
      answer
    });

  } catch (error) {
    console.error('获取答案详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取答案详情失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 获取问卷统计数据
 * 
 * 请求方法：GET
 * 请求路径：/api/answers/statistics/:questionnaireId
 * 
 * 统计数据包括：
 * - 总答案数
 * - 按来源分布
 * - 按设备类型分布
 * - 平均填写时长
 * 
 * 使用MongoDB聚合管道进行统计
 * 
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getStatistics(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { questionnaireId } = req.params;

    // 1. 获取问卷信息
    const questionnaire = await Questionnaire.findById(questionnaireId);
    
    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    // 2. 统计总答案数
    const totalAnswers = await Answer.countDocuments({ questionnaireId });

    // 3. 按来源统计（使用聚合管道）
    const sourceStats = await Answer.aggregate([
      { $match: { questionnaireId: new mongoose.Types.ObjectId(questionnaireId) } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
      // $match: 筛选条件
      // $group: 分组统计，_id是分组字段
    ]);

    // 4. 按设备类型统计
    const deviceStats = await Answer.aggregate([
      { $match: { questionnaireId: new mongoose.Types.ObjectId(questionnaireId) } },
      { $group: { _id: '$device', count: { $sum: 1 } } }
    ]);

    // 5. 计算平均填写时长
    const avgDurationResult = await Answer.aggregate([
      { $match: { questionnaireId: new mongoose.Types.ObjectId(questionnaireId) } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      // _id: null 表示所有文档作为一组
    ]);

    // 6. 返回统计数据
    res.json({
      success: true,
      questionnaire: {
        id: questionnaire._id,
        title: questionnaire.title,
        status: questionnaire.status,
        questionCount: questionnaire.questions.length
      },
      statistics: {
        totalAnswers,
        sourceStats: sourceStats.map(s => ({
          source: s._id,
          count: s.count
        })),
        deviceStats: deviceStats.map(s => ({
          device: s._id,
          count: s.count
        })),
        avgDuration: Math.round(avgDurationResult[0]?.avgDuration || 0)
      }
    });

  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}