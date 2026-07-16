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
import * as XLSX from 'xlsx';
import { Answer, AnswerValue } from '../models/Answer';
import { Questionnaire, IQuestion } from '../models/Questionnaire';

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

/**
 * 导出问卷答案数据
 *
 * 请求方法：GET
 * 请求路径：/api/answers/:questionnaireId/export
 * 查询参数：
 *   - format: 导出格式，'csv' 或 'excel'，默认 'csv'
 *
 * 处理流程：
 * 1. 验证问卷存在
 * 2. 拉取全部答案
 * 3. 以"题目标题"为表头，每份答案为一行
 * 4. 按 format 返回 CSV 文本或 Excel 二进制流
 *
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function exportAnswers(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { questionnaireId } = req.params;
    const format = (req.query.format as string) || 'csv';

    // 1. 验证问卷
    const questionnaire = await Questionnaire.findById(questionnaireId);

    if (!questionnaire) {
      res.status(404).json({
        success: false,
        message: '问卷不存在'
      });
      return;
    }

    // 2. 拉取全部答案（按提交时间升序，便于阅读）
    const answers = await Answer.find({ questionnaireId })
      .sort({ submittedAt: 1 });

    // 3. 构造表头与数据行
    const { headers, rows } = buildExportData(questionnaire.questions, answers);

    // 4. 根据格式返回
    if (format === 'excel') {
      // Excel: 使用 xlsx 生成二进制 Buffer
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Answers');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      }) as Buffer;

      const filename = encodeURIComponent(`问卷数据_${questionnaire.title}.xlsx`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      res.send(buffer);
      return;
    }

    // CSV: 文本输出，UTF-8 BOM 头确保 Excel 打开中文不乱码
    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCsvField).join(','))
      .join('\n');

    const filename = encodeURIComponent(`问卷数据_${questionnaire.title}.csv`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    // BOM + 内容
    res.send('\ufeff' + csvContent);

  } catch (error) {
    console.error('导出答案数据失败:', error);
    res.status(500).json({
      success: false,
      message: '导出答案数据失败',
      error: process.env.NODE_ENV === 'development'
        ? (error as Error).message
        : undefined
    });
  }
}

/**
 * 构造导出数据：表头 + 每行一份答案
 *
 * 表头顺序：提交时间 | 来源 | 设备 | 填写时长(秒) | 题目1 | 题目2 | ...
 * 题目列内容：按题型格式化
 *   - 单选/文本/评分：直接字符串
 *   - 多选：选项用 "|" 分隔
 *   - 矩阵：行:列 选择用 ";" 分隔
 *
 * @param questions 问卷题目
 * @param answers 答案列表
 */
function buildExportData(
  questions: IQuestion[],
  answers: { submittedAt: Date; source: string; device: string; duration: number; answers: AnswerValue[] }[]
): { headers: string[]; rows: (string | number)[][] } {
  // 基础列
  const baseHeaders = ['提交时间', '来源', '设备', '填写时长(秒)'];
  // 题目列：Q1. 题目标题
  const questionHeaders = questions.map(
    (q, i) => `Q${i + 1}. ${q.title}`
  );
  const headers = [...baseHeaders, ...questionHeaders];

  const rows = answers.map(answer => {
    // 基础信息
    const row: (string | number)[] = [
      new Date(answer.submittedAt).toISOString(),
      answer.source,
      answer.device,
      answer.duration
    ];

    // 每道题的答案，按题目顺序对齐；无答案则留空
    questions.forEach(q => {
      const ans = answer.answers.find(a => a.questionId === q.id);
      row.push(formatAnswerValue(ans?.value, q.type));
    });

    return row;
  });

  return { headers, rows };
}

/**
 * 按题型格式化单个答案为可读字符串
 *
 * @param value 答案值
 * @param questionType 题型
 */
function formatAnswerValue(
  value: string | string[] | number | Record<string, string> | undefined,
  questionType: string
): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  // 多选题：数组用 "|" 分隔
  if (questionType === 'multiple' && Array.isArray(value)) {
    return (value as string[]).join(' | ');
  }

  // 矩阵题：对象用 "行:列" 形式，多行用 ";" 分隔
  if (questionType === 'matrix' && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, string>)
      .map(([row, col]) => `${row}:${col}`)
      .join('; ');
  }

  // 其他题型（单选/文本/评分）：直接转字符串
  return String(value);
}

/**
 * CSV 字段转义：含逗号、引号、换行时用双引号包裹，内部双引号翻倍
 */
function escapeCsvField(value: string | number): string {
  const str = String(value);
  // 需要转义的字符：逗号、双引号、换行、回车
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}