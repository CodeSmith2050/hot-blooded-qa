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
 * 2. 获取客户端 IP 并脱敏（S-004）
 * 3. 防重复提交校验：同一 IP + 问卷在 DEDUP_WINDOW_MS 内只允许 1 次（F-006）
 * 4. 创建答案记录（含脱敏 IP）
 * 5. 返回提交成功响应
 *
 * 注意：此接口无需认证，公众可提交
 * 路由层另挂载全局限流中间件（S-005），防止单 IP 高频刷接口
 *
 * @param req - Express请求对象
 * @param res - Express响应对象
 */

// F-006 防重复提交时间窗口：同一 IP + 问卷在 10 秒内只允许 1 次提交
const DEDUP_WINDOW_MS = 10 * 1000;

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

    // 3. 获取客户端 IP 并脱敏（S-004）
    const ipAddress = maskIp(getClientIp(req));

    // 4. 防重复提交校验（F-006）
    //    同一脱敏 IP + 问卷在 DEDUP_WINDOW_MS 内已有答案 → 拒绝
    //    使用脱敏 IP 是因为：原始 IP 已不存储，仅以脱敏 IP 作为风控键
    //    代价是同一 /24 网段内多人在 10s 内只能 1 次提交，对低频业务可接受
    const dedupSince = new Date(Date.now() - DEDUP_WINDOW_MS);
    const recentAnswer = await Answer.findOne({
      ipAddress,
      questionnaireId,
      submittedAt: { $gt: dedupSince }
    })
      .sort({ submittedAt: -1 })
      .limit(1);

    if (recentAnswer) {
      res.status(429).json({
        success: false,
        message: '提交过于频繁，请稍后再试'
      });
      return;
    }

    // 5. 创建答案记录（含脱敏 IP）
    //    S-006 计算 isCompleted：所有 required 题目都有非空答案
    const isCompleted = checkCompletion(questionnaire.questions, answers);
    const answer = new Answer({
      questionnaireId,
      answers,
      respondent,
      source: source || 'web',
      device: device || detectDevice(req),
      ipAddress,
      duration: duration || 0,
      isCompleted
    });

    await answer.save();

    // 6. 返回成功响应
    res.status(201).json({
      success: true,
      message: '答案提交成功',
      answerId: answer._id,
      isCompleted
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
 * 完成度判定（S-006）
 *
 * 规则：问卷中所有 required=true 的题目都被作答（非空）→ 完成
 * 空值定义：
 *   - undefined / null / '' 视为未作答
 *   - 空数组 [] 视为未作答（多选题至少选 1 项）
 *   - 空对象 {} 视为未作答（矩阵题至少填 1 行）
 *   - 数字 0 视为已作答（评分题 0 分也是有效作答，但本系统 ratingMin=1）
 *
 * @param questions 问卷题目定义
 * @param answers 提交的答案列表
 * @returns 是否完成所有必答题
 */
function checkCompletion(
  questions: IQuestion[],
  answers: AnswerValue[]
): boolean {
  // 遍历所有 required 题目，任一未作答或空值 → false
  return questions.every(q => {
    if (!q.required) return true;
    const ans = answers.find(a => a.questionId === q.id);
    if (!ans) return false;
    return !isAnswerEmpty(ans.value);
  });
}

/**
 * 判断答案值是否为空
 */
function isAnswerEmpty(
  value: string | string[] | number | Record<string, string> | undefined
): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  // number 类型：0 也算已作答（评分题）
  return false;
}

/**
 * 获取客户端真实 IP
 *
 * 优先级：X-Forwarded-For 第一段 > X-Real-IP > req.ip > connection.remoteAddress
 * 注意：仅在信任的反向代理后才能信任 X-Forwarded-For（生产环境应配置 app.set('trust proxy')）
 *
 * @param req - Express请求对象
 */
function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.length > 0) {
    // X-Forwarded-For 可能是 "client, proxy1, proxy2"，取第一个
    return xForwardedFor.split(',')[0].trim();
  }
  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string' && xRealIp.length > 0) {
    return xRealIp.trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

/**
 * IP 脱敏：IPv4 保留前 3 段，末段置 0；非 IPv4 原样返回
 *
 * 示例：
 *   192.168.1.100 → 192.168.1.0
 *   10.0.0.5       → 10.0.0.0
 *   ::1            → ::1（非 IPv4 原样返回）
 *   unknown        → unknown
 *
 * @param ip 原始 IP 字符串
 */
function maskIp(ip: string): string {
  if (!ip) return '';
  // IPv4 标准格式判断
  const ipv4Match = ip.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (ipv4Match) {
    const parts = ip.split('.');
    parts[3] = '0';
    return parts.join('.');
  }
  // 处理 ::ffff:192.168.1.100 这种 IPv4-mapped IPv6 形式
  const mappedMatch = ip.match(/^::ffff:(\d{1,3}\.){3}\d{1,3}$/);
  if (mappedMatch) {
    const ipv4 = ip.replace('::ffff:', '');
    const parts = ipv4.split('.');
    parts[3] = '0';
    return `::ffff:${parts.join('.')}`;
  }
  // 其他形式（IPv6、unknown 等）原样返回
  return ip;
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

    // 2. 统计总答案数与完成数（S-006）
    const [totalAnswers, completedAnswers] = await Promise.all([
      Answer.countDocuments({ questionnaireId }),
      Answer.countDocuments({ questionnaireId, isCompleted: true })
    ]);
    // 完成率 = 完成数 / 总数 * 100，保留 1 位小数；分母为 0 时返回 0
    const completionRate = totalAnswers > 0
      ? Math.round((completedAnswers / totalAnswers) * 1000) / 10
      : 0;

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
        completedAnswers,        // S-006 完成数
        completionRate,          // S-006 完成率（百分比，1 位小数）
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
 * 仪表盘数据（V-008）
 *
 * 请求方法：GET
 * 请求路径：/api/answers/statistics/dashboard
 *
 * 跨问卷全局统计，返回管理员首页仪表盘所需的概览与分布数据。
 * 与 getStatistics（单问卷）不同，此接口聚合所有问卷 + 所有答案。
 *
 * 返回结构：
 *   {
 *     success: true,
 *     data: {
 *       overview: {
 *         totalQuestionnaires,    // 总问卷数
 *         activeQuestionnaires,   // 活跃问卷数（status=published）
 *         totalAnswers,           // 总填写数
 *         todayNewAnswers,        // 今日新增填写数
 *         avgDuration,            // 平均填写时长（秒，四舍五入）
 *         avgCompletionRate       // 平均完成率（百分比，1 位小数，S-006）
 *       },
 *       trend: [{ date: 'YYYY-MM-DD', count }],            // 近 7 天填写趋势
 *       sourceStats: [{ source, count }],                  // 来源分布（跨所有答案）
 *       deviceStats: [{ device, count }],                  // 设备分布（跨所有答案）
 *       questionnaireStatusStats: [{ status, count }],     // 问卷状态分布
 *       topQuestionnaires: [{ _id, title, answerCount, status }]  // 答卷数 Top 5
 *     }
 *   }
 *
 * 设计说明：
 *   - 完成率（S-006）：跨所有答案聚合 isCompleted=true 的占比，保留 1 位小数
 *   - 满意度分布需跨问卷聚合所有 rating 题型答案，逻辑复杂，留待 V-005 评分雷达图批次实现
 *   - 所有聚合均使用 MongoDB aggregate 管道，单次请求执行 7 个聚合查询
 *
 * @param req - Express请求对象
 * @param res - Express响应对象
 */
export async function getDashboard(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // 1. 概览：总问卷数、活跃问卷数、总填写数、今日新增、平均时长、完成数
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalQuestionnaires,
      activeQuestionnaires,
      totalAnswers,
      todayNewAnswers,
      avgDurationResult,
      completedAnswersResult
    ] = await Promise.all([
      Questionnaire.countDocuments(),
      Questionnaire.countDocuments({ status: 'published' }),
      Answer.countDocuments(),
      Answer.countDocuments({ submittedAt: { $gte: startOfToday } }),
      Answer.aggregate([
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ]),
      // S-006 跨问卷完成数
      Answer.aggregate([
        { $match: { isCompleted: true } },
        { $group: { _id: null, completed: { $sum: 1 } } }
      ])
    ]);

    // S-006 平均完成率 = 完成数 / 总数 * 100，保留 1 位小数
    const completedAnswers = completedAnswersResult[0]?.completed || 0;
    const avgCompletionRate = totalAnswers > 0
      ? Math.round((completedAnswers / totalAnswers) * 1000) / 10
      : 0;

    // 2. 近 7 天填写趋势：按日期分组
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const trendRaw = await Answer.aggregate([
      { $match: { submittedAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 补全缺失日期（无填写的日期 count=0），保证前端折线图连续
    const trend: { date: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const found = trendRaw.find(t => t._id === dateStr);
      trend.push({ date: dateStr, count: found ? found.count : 0 });
    }

    // 3. 来源分布（跨所有答案）
    const sourceStatsRaw = await Answer.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // 4. 设备分布（跨所有答案）
    const deviceStatsRaw = await Answer.aggregate([
      { $group: { _id: '$device', count: { $sum: 1 } } }
    ]);

    // 5. 问卷状态分布
    const questionnaireStatusStatsRaw = await Questionnaire.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 6. 答卷数 Top 5 问卷
    const topQuestionnairesRaw = await Answer.aggregate([
      { $group: { _id: '$questionnaireId', answerCount: { $sum: 1 } } },
      { $sort: { answerCount: -1 } },
      { $limit: 5 }
    ]);

    // 拉取 Top 5 问卷的标题与状态
    const topIds = topQuestionnairesRaw.map(t => t._id);
    const topQuestionnairesMeta = await Questionnaire.find({
      _id: { $in: topIds }
    }).select('title status');

    const metaMap = new Map(
      topQuestionnairesMeta.map(q => [String(q._id), q])
    );

    const topQuestionnaires = topQuestionnairesRaw.map(t => {
      const meta = metaMap.get(String(t._id));
      return {
        _id: t._id,
        title: meta?.title || '已删除问卷',
        answerCount: t.answerCount,
        status: meta?.status || 'closed'
      };
    });

    // 7. 返回仪表盘数据
    res.json({
      success: true,
      data: {
        overview: {
          totalQuestionnaires,
          activeQuestionnaires,
          totalAnswers,
          todayNewAnswers,
          avgDuration: Math.round(avgDurationResult[0]?.avgDuration || 0),
          avgCompletionRate  // S-006 跨问卷平均完成率
        },
        trend,
        sourceStats: sourceStatsRaw.map(s => ({
          source: s._id,
          count: s.count
        })),
        deviceStats: deviceStatsRaw.map(s => ({
          device: s._id,
          count: s.count
        })),
        questionnaireStatusStats: questionnaireStatusStatsRaw.map(s => ({
          status: s._id,
          count: s.count
        })),
        topQuestionnaires
      }
    });

  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取仪表盘数据失败',
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
    } else if (question.type === 'matrix') {
      // E-002 矩阵题：按行聚合，每行返回各列选项的计数与百分比
      // 答案值结构：Record<string, string>，key 为行标题，value 为该行选中的列标题
      const rows = question.matrixRows || [];
      const cols = question.matrixCols || [];

      // rowStats: 每行一个对象 { row, totalResponses, columns: [{col, count, percentage}] }
      base.rowStats = rows.map(row => {
        // 该行所有作答值（每个答案中 row 对应的列选择）
        const rowValues = values
          .map(v => {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return (v as Record<string, string>)[row];
            }
            return undefined;
          })
          .filter(v => v !== undefined && v !== null && v !== '');

        const rowTotal = rowValues.length;
        return {
          row,
          totalResponses: rowTotal,
          columns: cols.map(col => {
            const count = rowValues.filter(v => v === col).length;
            return {
              col,
              count,
              // 百分比基于该行的总作答数，保留 1 位小数
              percentage: rowTotal > 0
                ? Math.round((count / rowTotal) * 1000) / 10
                : 0
            };
          })
        };
      });
    }

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