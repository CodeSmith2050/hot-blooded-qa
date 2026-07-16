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
 * - 题目级统计分布（D-004）：
 *   - 单选/多选：选项计数 + 百分比
 *   - 文本：去重计数（按计数降序）
 *   - 评分：平均分 + 评分分布
 *   - 矩阵：每行×列计数（暂留空，待 E-002 矩阵题完整支持后再实现）
 *
 * 使用MongoDB聚合管道进行整体维度统计；
 * 题目级分布通过内存聚合实现（题目数量有限，全量加载答案更高效，
 * 且便于一次扫描完成所有题型的统计）。
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

    // 6. 题目级统计分布（D-004）：拉取全部答案后内存聚合
    const allAnswers = await Answer.find({ questionnaireId }).select('answers');
    const questionStats = buildQuestionStats(questionnaire.questions, allAnswers);

    // 7. 返回统计数据
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
        avgDuration: Math.round(avgDurationResult[0]?.avgDuration || 0),
        questionStats
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
 * 题目级统计分布构造（D-004）
 *
 * 按题型分支聚合，返回前端 StatisticsPage 渲染所需的契约结构：
 *   - 单选 single / 多选 multiple：options 列表 + 计数 + 百分比
 *   - 文本 text：textResponses 去重列表（按计数降序）
 *   - 评分 rating：averageRating + ratingDistribution（1~ratingMax 各档位计数）
 *   - 矩阵 matrix：暂返回 totalResponses，分布待 E-002 矩阵题完整支持后补齐
 *
 * 说明：
 *   - totalResponses = 该题已被作答（且非空）的答案数；多选题每份答案计 1 次
 *   - 单选百分比基数 = totalResponses
 *   - 多选百分比基数 = totalResponses（一份答案选 N 个选项，分母仍是答案数）
 *   - 文本/评分不返回 options，仅返回相应字段
 *
 * @param questions 问卷题目定义（含选项、ratingMax 等）
 * @param allAnswers 全部答案（仅需 answers 字段）
 */
function buildQuestionStats(
  questions: IQuestion[],
  allAnswers: { answers: AnswerValue[] }[]
): any[] {
  return questions.map((question, index) => {
    // 提取该题全部作答值（跳过空值）
    const values = allAnswers
      .map(a => a.answers.find(av => av.questionId === question.id)?.value)
      .filter(v => v !== undefined && v !== null && v !== '' &&
        !(Array.isArray(v) && v.length === 0));

    const totalResponses = values.length;
    const base: any = {
      questionIndex: index,
      questionId: question.id,
      questionTitle: question.title,
      questionType: question.type,
      totalResponses
    };

    if (question.type === 'single' || question.type === 'multiple') {
      // 单选/多选：选项计数
      const optionsCount = new Map<string, number>();
      // 按问卷定义的选项顺序初始化，保证返回顺序稳定
      (question.options || []).forEach(opt => optionsCount.set(opt, 0));

      values.forEach(v => {
        if (question.type === 'multiple' && Array.isArray(v)) {
          (v as string[]).forEach(opt => {
            optionsCount.set(opt, (optionsCount.get(opt) || 0) + 1);
          });
        } else {
          const opt = String(v);
          optionsCount.set(opt, (optionsCount.get(opt) || 0) + 1);
        }
      });

      base.options = (question.options || []).map(opt => {
        const count = optionsCount.get(opt) || 0;
        return {
          text: opt,
          count,
          // 百分比四舍五入到 1 位小数；分母为 0 时返回 0
          percentage: totalResponses > 0
            ? Math.round((count / totalResponses) * 1000) / 10
            : 0
        };
      });
    } else if (question.type === 'text') {
      // 文本题：去重计数，按计数降序
      const countMap = new Map<string, number>();
      values.forEach(v => {
        const text = String(v).trim();
        if (!text) return;
        countMap.set(text, (countMap.get(text) || 0) + 1);
      });
      base.textResponses = Array.from(countMap.entries())
        .map(([content, count]) => ({ content, count }))
        .sort((a, b) => b.count - a.count);
    } else if (question.type === 'rating') {
      // 评分题：平均分 + 评分分布
      const numericValues = values
        .map(v => Number(v))
        .filter(n => !Number.isNaN(n));
      const ratingMax = question.ratingMax || 5;
      const sum = numericValues.reduce((acc, n) => acc + n, 0);
      base.averageRating = numericValues.length > 0
        ? Math.round((sum / numericValues.length) * 100) / 100
        : 0;
      const distribution: { rating: number; count: number }[] = [];
      for (let r = 1; r <= ratingMax; r++) {
        distribution.push({
          rating: r,
          count: numericValues.filter(n => n === r).length
        });
      }
      base.ratingDistribution = distribution;
    }
    // matrix 类型：当前 totalResponses 已返回，分布待 E-002 完整支持后补齐

    return base;
  });
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