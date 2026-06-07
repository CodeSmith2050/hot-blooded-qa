import { Request, Response } from 'express';
import { Questionnaire } from '../models/Questionnaire';

// 获取问卷列表
export async function getQuestionnaires(req: Request, res: Response): Promise<void> {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const userId = req.userId;

    const query: any = { createdBy: userId };
    if (status) query.status = status;
    if (search) query.title = { $regex: search, $options: 'i' };

    const total = await Questionnaire.countDocuments(query);
    const questionnaires = await Questionnaire.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({
      questionnaires,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: '获取问卷列表失败', error: (error as Error).message });
  }
}

// 获取单个问卷
export async function getQuestionnaire(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const questionnaire = await Questionnaire.findById(id);

    if (!questionnaire) {
      res.status(404).json({ message: '问卷不存在' });
      return;
    }

    res.json({ questionnaire });
  } catch (error) {
    res.status(500).json({ message: '获取问卷失败', error: (error as Error).message });
  }
}

// 创建问卷
export async function createQuestionnaire(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, questions } = req.body;
    const userId = req.userId;

    const questionnaire = new Questionnaire({
      title,
      description,
      questions,
      createdBy: userId,
    });

    await questionnaire.save();

    res.status(201).json({
      message: '问卷创建成功',
      questionnaire,
    });
  } catch (error) {
    res.status(500).json({ message: '创建问卷失败', error: (error as Error).message });
  }
}

// 更新问卷
export async function updateQuestionnaire(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { title, description, questions } = req.body;

    const questionnaire = await Questionnaire.findById(id);
    if (!questionnaire) {
      res.status(404).json({ message: '问卷不存在' });
      return;
    }

    // 只有草稿状态才能编辑
    if (questionnaire.status !== 'draft') {
      res.status(400).json({ message: '只有草稿状态的问卷才能编辑' });
      return;
    }

    questionnaire.title = title;
    questionnaire.description = description;
    questionnaire.questions = questions;
    await questionnaire.save();

    res.json({
      message: '问卷更新成功',
      questionnaire,
    });
  } catch (error) {
    res.status(500).json({ message: '更新问卷失败', error: (error as Error).message });
  }
}

// 删除问卷
export async function deleteQuestionnaire(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const questionnaire = await Questionnaire.findById(id);
    if (!questionnaire) {
      res.status(404).json({ message: '问卷不存在' });
      return;
    }

    await questionnaire.deleteOne();

    res.json({ message: '问卷删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除问卷失败', error: (error as Error).message });
  }
}

// 发布问卷
export async function publishQuestionnaire(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const questionnaire = await Questionnaire.findById(id);
    if (!questionnaire) {
      res.status(404).json({ message: '问卷不存在' });
      return;
    }

    if (questionnaire.status !== 'draft') {
      res.status(400).json({ message: '只有草稿状态的问卷才能发布' });
      return;
    }

    questionnaire.status = 'published';
    questionnaire.publishedAt = new Date();
    await questionnaire.save();

    res.json({
      message: '问卷发布成功',
      questionnaire,
    });
  } catch (error) {
    res.status(500).json({ message: '发布问卷失败', error: (error as Error).message });
  }
}

// 关闭问卷
export async function closeQuestionnaire(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const questionnaire = await Questionnaire.findById(id);
    if (!questionnaire) {
      res.status(404).json({ message: '问卷不存在' });
      return;
    }

    if (questionnaire.status !== 'published') {
      res.status(400).json({ message: '只有已发布的问卷才能关闭' });
      return;
    }

    questionnaire.status = 'closed';
    questionnaire.closedAt = new Date();
    await questionnaire.save();

    res.json({
      message: '问卷关闭成功',
      questionnaire,
    });
  } catch (error) {
    res.status(500).json({ message: '关闭问卷失败', error: (error as Error).message });
  }
}