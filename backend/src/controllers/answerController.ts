import { Request, Response } from 'express';
import { Answer } from '../models/Answer';
import { Questionnaire } from '../models/Questionnaire';

// 提交答案
export async function submitAnswer(req: Request, res: Response): Promise<void> {
  try {
    const { questionnaireId, answers, respondent, source, device, duration } = req.body;

    // 验证问卷是否存在且已发布
    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      res.status(404).json({ message: '问卷不存在' });
      return;
    }

    if (questionnaire.status !== 'published') {
      res.status(400).json({ message: '问卷未发布或已关闭' });
      return;
    }

    // 创建答案记录
    const answer = new Answer({
      questionnaireId,
      answers,
      respondent,
      source: source || 'web',
      device: device || 'desktop',
      duration: duration || 0,
    });

    await answer.save();

    res.status(201).json({
      message: '答案提交成功',
      answerId: answer._id,
    });
  } catch (error) {
    res.status(500).json({ message: '提交答案失败', error: (error as Error).message });
  }
}

// 获取答案列表
export async function getAnswers(req: Request, res: Response): Promise<void> {
  try {
    const { questionnaireId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const total = await Answer.countDocuments({ questionnaireId });
    const answers = await Answer.find({ questionnaireId })
      .sort({ submittedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      answers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: '获取答案列表失败', error: (error as Error).message });
  }
}

// 获取答案详情
export async function getAnswerDetail(req: Request, res: Response): Promise<void> {
  try {
    const { answerId } = req.params;
    const answer = await Answer.findById(answerId);

    if (!answer) {
      res.status(404).json({ message: '答案不存在' });
      return;
    }

    res.json({ answer });
  } catch (error) {
    res.status(500).json({ message: '获取答案详情失败', error: (error as Error).message });
  }
}

// 获取统计数据
export async function getStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { questionnaireId } = req.params;

    // 获取问卷信息
    const questionnaire = await Questionnaire.findById(questionnaireId);
    if (!questionnaire) {
      res.status(404).json({ message: '问卷不存在' });
      return;
    }

    // 统计基本信息
    const totalAnswers = await Answer.countDocuments({ questionnaireId });
    
    // 按来源统计
    const sourceStats = await Answer.aggregate([
      { $match: { questionnaireId: new (require('mongoose').Types.ObjectId)(questionnaireId) } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);

    // 按设备统计
    const deviceStats = await Answer.aggregate([
      { $match: { questionnaireId: new (require('mongoose').Types.ObjectId)(questionnaireId) } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
    ]);

    // 平均填写时长
    const avgDuration = await Answer.aggregate([
      { $match: { questionnaireId: new (require('mongoose').Types.ObjectId)(questionnaireId) } },
      { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
    ]);

    res.json({
      questionnaire: {
        id: questionnaire._id,
        title: questionnaire.title,
        questions: questionnaire.questions,
      },
      statistics: {
        totalAnswers,
        sourceStats,
        deviceStats,
        avgDuration: avgDuration[0]?.avgDuration || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: '获取统计数据失败', error: (error as Error).message });
  }
}