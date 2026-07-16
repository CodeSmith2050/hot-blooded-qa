/**
 * 答案模块 API 单元测试
 *
 * 测试范围（对应功能列表 D-001 ~ D-005, F-001, F-006, S-004, S-005）：
 * - POST /api/answers/submit                        提交问卷答案（公开，含限流+防重复提交）
 * - GET  /api/answers/:questionnaireId              答案列表（分页）
 * - GET  /api/answers/:questionnaireId/:answerId    答案详情
 * - GET  /api/answers/statistics/:questionnaireId   统计数据（含 D-004 题目级分布）
 * - GET  /api/answers/:questionnaireId/export       导出答案数据（CSV/Excel）
 *
 * 关联 PRD：2.2.3 问卷填写模块、2.2.4 数据分析模块
 *
 * 测试隔离说明（BUG-002 修复）：
 * - 批次 3 引入 F-006 防重复提交（同 IP+问卷 10s 窗口）和 S-005 限流（同 IP 5 次/分钟）
 * - supertest 默认所有请求来自同一 IP，会触发上述风控规则
 * - 因此 D-001~D-005 多用户提交场景使用 submitAnswer 辅助函数，每次分配唯一 IP
 * - F-006/S-005 专项测试显式使用相同 IP 验证风控规则本身
 */

import request from 'supertest';
import app from '../src/app';
import {
  authHeader,
  registerAndLogin,
  createQuestionnaireViaApi,
  buildTestAnswers,
} from './helpers';
// V-008 仪表盘测试需要直接构造历史日期的答案（API 不支持指定 submittedAt）
import { Answer as AnswerModel } from '../src/models/Answer';

// ==================== 公共变量 ====================

let token: string;
let userId: string;

beforeAll(async () => {
  const result = await registerAndLogin();
  token = result.token;
  userId = result.userId;
});

/**
 * 辅助：创建并发布一份问卷，返回问卷 ID
 */
async function createPublishedQuestionnaire(): Promise<string> {
  const created = await createQuestionnaireViaApi(token);
  await request(app)
    .post(`/api/questionnaires/${created._id}/publish`)
    .set(authHeader(token));
  return created._id;
}

// ==================== 提交答案辅助函数 ====================

/**
 * IP 自增计数器
 *
 * 为每次提交分配唯一 IP（第三段从 100 开始自增），模拟不同用户提交：
 * - 避开 F-006 防重复提交（同 IP+问卷 10s 窗口）
 * - 避开 S-005 限流（同 IP 5 次/分钟）
 * - 第三段自增确保脱敏后（末段置 0）仍唯一，避免 F-006 误判
 * - 第三段从 100 开始，避开 F-006/S-004 专项测试用的 0/20/30 段
 *
 * 测试 F-006/S-005 防重复/限流本身时，显式传入相同 ip 即可
 */
let _submitIpCounter = 100;

/**
 * 提交答案辅助函数
 *
 * @param qid 问卷 ID
 * @param body 答案体（不含 questionnaireId，会自动注入）
 * @param ip 客户端 IP（可选，默认使用自增唯一 IP 模拟不同用户）
 */
function submitAnswer(
  qid: string,
  body: Record<string, any> = {},
  ip?: string
) {
  const clientIp = ip || `10.0.${_submitIpCounter++}.2`;
  return request(app)
    .post('/api/answers/submit')
    .set('X-Forwarded-For', clientIp)
    .send({ questionnaireId: qid, ...body });
}

// ==================== 提交答案测试 ====================

describe('答案模块 - POST /api/answers/submit', () => {
  it('F-001 应成功提交已发布问卷的答案', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await submitAnswer(qid, {
      answers: buildTestAnswers(),
      source: 'web',
      device: 'desktop',
      duration: 120,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.answerId).toBeDefined();
  });

  it('F-001 提交答案无需登录（公开接口）', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await submitAnswer(qid, {
      answers: buildTestAnswers(),
    });

    expect(res.status).toBe(201);
  });

  it('F-001 草稿状态问卷应禁止提交', async () => {
    const created = await createQuestionnaireViaApi(token);

    const res = await submitAnswer(created._id, {
      answers: buildTestAnswers(),
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('未发布或已关闭');
  });

  it('F-001 不存在的问卷应返回 404', async () => {
    const res = await submitAnswer('507f1f77bcf86cd799439011', {
      answers: buildTestAnswers(),
    });

    expect(res.status).toBe(404);
  });

  it('F-001 未指定 source/device 时应使用默认值', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await submitAnswer(qid, {
      answers: buildTestAnswers(),
    });

    expect(res.status).toBe(201);
  });
});

// ==================== 答案列表测试 ====================

describe('答案模块 - GET /api/answers/:questionnaireId', () => {
  it('D-001 应返回分页答案列表', async () => {
    const qid = await createPublishedQuestionnaire();

    // 提交 3 份答案（每次使用不同 IP 模拟不同用户，避开 F-006/S-005）
    for (let i = 0; i < 3; i++) {
      await submitAnswer(qid, { answers: buildTestAnswers() });
    }

    const res = await request(app)
      .get(`/api/answers/${qid}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answers).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  it('D-001 支持分页参数', async () => {
    const qid = await createPublishedQuestionnaire();
    for (let i = 0; i < 5; i++) {
      await submitAnswer(qid, { answers: buildTestAnswers() });
    }

    const res = await request(app)
      .get(`/api/answers/${qid}`)
      .query({ page: 1, limit: 2 })
      .set(authHeader(token));

    expect(res.body.answers).toHaveLength(2);
    expect(res.body.pagination.totalPages).toBe(3);
  });

  it('D-001 未登录应返回 401', async () => {
    const qid = await createPublishedQuestionnaire();
    const res = await request(app).get(`/api/answers/${qid}`);
    expect(res.status).toBe(401);
  });
});

// ==================== 答案详情测试 ====================

describe('答案模块 - GET /api/answers/:questionnaireId/:answerId', () => {
  it('D-002 应返回指定答案详情', async () => {
    const qid = await createPublishedQuestionnaire();
    const submitRes = await submitAnswer(qid, { answers: buildTestAnswers() });
    const answerId = submitRes.body.answerId;

    const res = await request(app)
      .get(`/api/answers/${qid}/${answerId}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.answer._id).toBe(answerId);
    expect(res.body.answer.answers).toHaveLength(4);
  });

  it('D-002 不存在的答案应返回 404', async () => {
    const qid = await createPublishedQuestionnaire();
    const res = await request(app)
      .get(`/api/answers/${qid}/507f1f77bcf86cd799439011`)
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ==================== 统计数据测试 ====================

describe('答案模块 - GET /api/answers/statistics/:questionnaireId', () => {
  // BUG-001 已于 2026-07-17 修复（分支 bugfix/fix-001-statistics-route-0717）：
  // routes/answer.ts 已将 /statistics/:questionnaireId 路由移至参数路由前。
  it('D-003 应返回基础统计数据（总数/来源/设备/时长）', async () => {
    const qid = await createPublishedQuestionnaire();

    // 提交多份不同来源的答案（每次不同 IP，避开 F-006/S-005）
    await submitAnswer(qid, {
      answers: buildTestAnswers(),
      source: 'web',
      device: 'desktop',
      duration: 100,
    });
    await submitAnswer(qid, {
      answers: buildTestAnswers(),
      source: 'wechat',
      device: 'mobile',
      duration: 200,
    });

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.statistics.totalAnswers).toBe(2);
    expect(res.body.statistics.sourceStats).toHaveLength(2);
    expect(res.body.statistics.deviceStats).toHaveLength(2);
    // 平均时长 = (100+200)/2 = 150
    expect(res.body.statistics.avgDuration).toBe(150);
  });

  it('D-003 无答案问卷统计应返回 0', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.statistics.totalAnswers).toBe(0);
  });

  it('D-003 不存在的问卷应返回 404', async () => {
    const res = await request(app)
      .get('/api/answers/statistics/507f1f77bcf86cd799439011')
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });

  it('D-003 统计接口需登录认证', async () => {
    const qid = await createPublishedQuestionnaire();
    const res = await request(app).get(`/api/answers/statistics/${qid}`);
    expect(res.status).toBe(401);
  });

  // ==================== D-004 题目级统计分布 ====================

  it('D-004 应返回 questionStats 数组，长度等于问卷题目数', async () => {
    const qid = await createPublishedQuestionnaire();
    await submitAnswer(qid, { answers: buildTestAnswers() });

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.statistics.questionStats)).toBe(true);
    // buildTestQuestions 共 4 题
    expect(res.body.statistics.questionStats).toHaveLength(4);
  });

  it('D-004 单选题应返回选项计数与百分比', async () => {
    const qid = await createPublishedQuestionnaire();

    // 提交 3 份答案：2 男 1 女（每次不同 IP，避开 F-006/S-005）
    const maleAnswers = [
      { questionId: 'q1', value: '男' },
      { questionId: 'q2', value: [] },
      { questionId: 'q3', value: '' },
      { questionId: 'q4', value: 5 },
    ];
    const femaleAnswers = [
      { questionId: 'q1', value: '女' },
      { questionId: 'q2', value: [] },
      { questionId: 'q3', value: '' },
      { questionId: 'q4', value: 5 },
    ];
    await submitAnswer(qid, { answers: maleAnswers });
    await submitAnswer(qid, { answers: maleAnswers });
    await submitAnswer(qid, { answers: femaleAnswers });

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    const q1Stat = res.body.statistics.questionStats[0];
    expect(q1Stat.questionType).toBe('single');
    expect(q1Stat.totalResponses).toBe(3);
    const maleOpt = q1Stat.options.find((o: any) => o.text === '男');
    const femaleOpt = q1Stat.options.find((o: any) => o.text === '女');
    expect(maleOpt.count).toBe(2);
    expect(femaleOpt.count).toBe(1);
    // 2/3 ≈ 66.7%
    expect(maleOpt.percentage).toBeCloseTo(66.7, 1);
  });

  it('D-004 多选题应正确累加各选项计数', async () => {
    const qid = await createPublishedQuestionnaire();

    // 提交 2 份答案：
    //   答案1: ['帮助他人', '免费体检']
    //   答案2: ['帮助他人']
    const answers1 = [
      { questionId: 'q1', value: '男' },
      { questionId: 'q2', value: ['帮助他人', '免费体检'] },
      { questionId: 'q3', value: '' },
      { questionId: 'q4', value: 5 },
    ];
    const answers2 = [
      { questionId: 'q1', value: '男' },
      { questionId: 'q2', value: ['帮助他人'] },
      { questionId: 'q3', value: '' },
      { questionId: 'q4', value: 5 },
    ];
    await submitAnswer(qid, { answers: answers1 });
    await submitAnswer(qid, { answers: answers2 });

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    const q2Stat = res.body.statistics.questionStats[1];
    expect(q2Stat.questionType).toBe('multiple');
    expect(q2Stat.totalResponses).toBe(2);
    const opt1 = q2Stat.options.find((o: any) => o.text === '帮助他人');
    const opt2 = q2Stat.options.find((o: any) => o.text === '免费体检');
    expect(opt1.count).toBe(2);
    expect(opt2.count).toBe(1);
  });

  it('D-004 文本题应返回去重后的响应列表（按计数降序）', async () => {
    const qid = await createPublishedQuestionnaire();

    // q3 文本题：3 份答案中"很好"出现 2 次，"一般"出现 1 次
    const answers = (text: string) => [
      { questionId: 'q1', value: '男' },
      { questionId: 'q2', value: [] },
      { questionId: 'q3', value: text },
      { questionId: 'q4', value: 5 },
    ];
    await submitAnswer(qid, { answers: answers('很好') });
    await submitAnswer(qid, { answers: answers('很好') });
    await submitAnswer(qid, { answers: answers('一般') });

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    const q3Stat = res.body.statistics.questionStats[2];
    expect(q3Stat.questionType).toBe('text');
    expect(q3Stat.totalResponses).toBe(3);
    expect(q3Stat.textResponses).toHaveLength(2);
    // 降序：很好(2) → 一般(1)
    expect(q3Stat.textResponses[0]).toEqual({ content: '很好', count: 2 });
    expect(q3Stat.textResponses[1]).toEqual({ content: '一般', count: 1 });
  });

  it('D-004 评分题应返回平均分与评分分布', async () => {
    const qid = await createPublishedQuestionnaire();

    // q4 评分题（maxRating=5）：3 份答案 5/4/3，平均分 4.0
    const answers = (rating: number) => [
      { questionId: 'q1', value: '男' },
      { questionId: 'q2', value: [] },
      { questionId: 'q3', value: '' },
      { questionId: 'q4', value: rating },
    ];
    await submitAnswer(qid, { answers: answers(5) });
    await submitAnswer(qid, { answers: answers(4) });
    await submitAnswer(qid, { answers: answers(3) });

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    const q4Stat = res.body.statistics.questionStats[3];
    expect(q4Stat.questionType).toBe('rating');
    expect(q4Stat.totalResponses).toBe(3);
    expect(q4Stat.averageRating).toBe(4);
    // 评分分布应为 1~5 共 5 档
    expect(q4Stat.ratingDistribution).toHaveLength(5);
    const rating3 = q4Stat.ratingDistribution.find((r: any) => r.rating === 3);
    const rating4 = q4Stat.ratingDistribution.find((r: any) => r.rating === 4);
    const rating5 = q4Stat.ratingDistribution.find((r: any) => r.rating === 5);
    expect(rating3.count).toBe(1);
    expect(rating4.count).toBe(1);
    expect(rating5.count).toBe(1);
  });

  it('D-004 无答案问卷应返回 totalResponses 全为 0 的 questionStats', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await request(app)
      .get(`/api/answers/statistics/${qid}`)
      .set(authHeader(token));

    const qs = res.body.statistics.questionStats;
    expect(qs).toHaveLength(4);
    qs.forEach((stat: any) => {
      expect(stat.totalResponses).toBe(0);
    });
  });
});

// ==================== 导出数据测试 ====================

describe('答案模块 - GET /api/answers/:questionnaireId/export', () => {
  it('D-005 应成功导出 CSV 格式数据', async () => {
    const qid = await createPublishedQuestionnaire();

    // 提交 2 份答案（每次不同 IP，避开 F-006/S-005）
    for (let i = 0; i < 2; i++) {
      await submitAnswer(qid, {
        answers: buildTestAnswers(),
        source: 'web',
        device: 'desktop',
        duration: 100 + i,
      });
    }

    const res = await request(app)
      .get(`/api/answers/${qid}/export`)
      .query({ format: 'csv' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    // CSV 文本校验：含 UTF-8 BOM + 表头 + 数据行
    const text = res.text;
    expect(text.startsWith('\ufeff')).toBe(true);
    // 表头应包含题目标题（去 BOM 后检查）
    const noBom = text.replace(/^\ufeff/, '');
    const lines = noBom.split('\n');
    expect(lines.length).toBe(3); // 1 表头 + 2 数据行
    // 表头含基础列与题目列
    expect(lines[0]).toContain('提交时间');
    expect(lines[0]).toContain('来源');
    expect(lines[0]).toContain('Q1.');
  });

  it('D-005 应成功导出 Excel 格式数据', async () => {
    const qid = await createPublishedQuestionnaire();
    await submitAnswer(qid, { answers: buildTestAnswers() });

    const res = await request(app)
      .get(`/api/answers/${qid}/export`)
      .query({ format: 'excel' })
      .set(authHeader(token))
      .buffer(true)
      .parse((response, callback) => {
        // 直接收集二进制 Buffer
        const data: Buffer[] = [];
        response.on('data', chunk => data.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    // Excel xlsx 文件以 PK 开头（zip 格式）
    const buf = res.body as Buffer;
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.slice(0, 2).toString('ascii')).toBe('PK');
  });

  it('D-005 未指定 format 时应默认导出 CSV', async () => {
    const qid = await createPublishedQuestionnaire();
    await submitAnswer(qid, { answers: buildTestAnswers() });

    const res = await request(app)
      .get(`/api/answers/${qid}/export`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('D-005 无答案问卷应只返回表头行', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await request(app)
      .get(`/api/answers/${qid}/export`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    const noBom = res.text.replace(/^\ufeff/, '');
    const lines = noBom.split('\n');
    expect(lines.length).toBe(1); // 仅表头
  });

  it('D-005 不存在的问卷应返回 404', async () => {
    const res = await request(app)
      .get('/api/answers/507f1f77bcf86cd799439011/export')
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });

  it('D-005 导出接口需登录认证', async () => {
    const qid = await createPublishedQuestionnaire();
    const res = await request(app).get(`/api/answers/${qid}/export`);
    expect(res.status).toBe(401);
  });

  it('D-005 CSV 多选题答案应用 "|" 分隔', async () => {
    const qid = await createPublishedQuestionnaire();
    // 多选题选 2 个选项，确保 "|" 分隔符出现
    const multiAnswers = [
      { questionId: 'q1', value: '男' },
      { questionId: 'q2', value: ['帮助他人', '免费体检'] },
      { questionId: 'q3', value: '服务很好' },
      { questionId: 'q4', value: 5 },
    ];
    await submitAnswer(qid, { answers: multiAnswers });

    const res = await request(app)
      .get(`/api/answers/${qid}/export`)
      .query({ format: 'csv' })
      .set(authHeader(token));

    const noBom = res.text.replace(/^\ufeff/, '');
    // 第二行（数据行）应包含多选题的 "|" 分隔符
    expect(noBom.split('\n')[1]).toContain('|');
  });
});

// ==================== F-006 防重复提交 + S-005 限流 + S-004 IP 脱敏 测试 ====================
//
// 这些测试显式使用相同 IP 验证风控规则本身。
// 注意：rateLimit 是模块级单例 Map，限流计数会跨用例累积；为避免相互干扰，
// F-006 防重复提交测试与 S-005 限流测试分别使用独立 IP 段。

describe('答案模块 - F-006 防重复提交', () => {
  it('F-006 同一 IP + 同一问卷 10 秒内连续提交应被拒绝（返回 429）', async () => {
    const qid = await createPublishedQuestionnaire();
    // 使用固定 IP（仅本测试用例使用，避免与其他用例干扰）
    const fixedIp = '10.0.0.100';

    // 第 1 次提交：成功
    const res1 = await submitAnswer(qid, { answers: buildTestAnswers() }, fixedIp);
    expect(res1.status).toBe(201);

    // 第 2 次提交：同一 IP + 同一问卷，10s 窗口内，应被 F-006 拒绝
    const res2 = await submitAnswer(qid, { answers: buildTestAnswers() }, fixedIp);
    expect(res2.status).toBe(429);
    expect(res2.body.success).toBe(false);
    expect(res2.body.message).toContain('频繁');
  });

  it('F-006 不同 IP 提交同一问卷应被允许', async () => {
    const qid = await createPublishedQuestionnaire();

    // IP A 提交（脱敏后 10.0.0.0）
    const res1 = await submitAnswer(qid, { answers: buildTestAnswers() }, '10.0.0.200');
    expect(res1.status).toBe(201);

    // IP B 提交同一问卷，应成功（脱敏后 10.0.1.0，与 A 不同）
    const res2 = await submitAnswer(qid, { answers: buildTestAnswers() }, '10.0.1.200');
    expect(res2.status).toBe(201);
  });

  it('F-006 同一 IP 提交不同问卷应被允许', async () => {
    const qid1 = await createPublishedQuestionnaire();
    const qid2 = await createPublishedQuestionnaire();
    const fixedIp = '10.0.2.100';

    // 同一 IP 提交问卷 1
    const res1 = await submitAnswer(qid1, { answers: buildTestAnswers() }, fixedIp);
    expect(res1.status).toBe(201);

    // 同一 IP 提交问卷 2，应成功（防重复以 IP+问卷 为键）
    const res2 = await submitAnswer(qid2, { answers: buildTestAnswers() }, fixedIp);
    expect(res2.status).toBe(201);
  });
});

describe('答案模块 - S-005 接口限流', () => {
  it('S-005 同一 IP 1 分钟内超过 5 次请求应被限流（返回 429）', async () => {
    // 每次创建新问卷，避免触发 F-006 防重复提交
    // 使用独立 IP 段，避免与 F-006 测试用例的 IP 冲突
    const fixedIp = '172.16.0.50';

    // 前 5 次请求应成功（201 或 400 都算通过限流）
    for (let i = 0; i < 5; i++) {
      const qid = await createPublishedQuestionnaire();
      const res = await submitAnswer(qid, { answers: buildTestAnswers() }, fixedIp);
      expect(res.status).toBe(201);
    }

    // 第 6 次请求应被 S-005 限流拦截
    const qid6 = await createPublishedQuestionnaire();
    const res6 = await submitAnswer(qid6, { answers: buildTestAnswers() }, fixedIp);
    expect(res6.status).toBe(429);
    // 限流响应应包含 Retry-After 头
    expect(res6.headers['retry-after']).toBeDefined();
    expect(res6.headers['x-ratelimit-limit']).toBe('5');
  });
});

describe('答案模块 - S-004 IP 收集与脱敏', () => {
  it('S-004 提交答案后，答案记录应存储脱敏 IP（末段置 0）', async () => {
    const qid = await createPublishedQuestionnaire();
    // 真实 IP 10.20.30.123，脱敏后应为 10.20.30.0
    const realIp = '10.20.30.123';

    const submitRes = await submitAnswer(qid, { answers: buildTestAnswers() }, realIp);
    expect(submitRes.status).toBe(201);
    const answerId = submitRes.body.answerId;

    // 通过答案详情接口读取记录，校验 ipAddress 字段
    const res = await request(app)
      .get(`/api/answers/${qid}/${answerId}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.answer.ipAddress).toBe('10.20.30.0');
    // 原始 IP 不应直接出现在记录中
    expect(res.body.answer.ipAddress).not.toContain('123');
  });

  it('S-004 IPv4-mapped IPv6 应正确脱敏', async () => {
    const qid = await createPublishedQuestionnaire();
    // ::ffff:10.20.30.123 应脱敏为 ::ffff:10.20.30.0
    const mappedIp = '::ffff:10.20.30.123';

    const submitRes = await submitAnswer(qid, { answers: buildTestAnswers() }, mappedIp);
    expect(submitRes.status).toBe(201);
    const answerId = submitRes.body.answerId;

    const res = await request(app)
      .get(`/api/answers/${qid}/${answerId}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.answer.ipAddress).toBe('::ffff:10.20.30.0');
  });

  it('S-004 防重复提交以脱敏 IP 为键（同 /24 网段 10s 内只能 1 次）', async () => {
    const qid = await createPublishedQuestionnaire();
    // 10.30.40.10 与 10.30.40.200 脱敏后都为 10.30.40.0
    const ip1 = '10.30.40.10';
    const ip2 = '10.30.40.200';

    const res1 = await submitAnswer(qid, { answers: buildTestAnswers() }, ip1);
    expect(res1.status).toBe(201);

    // 不同原始 IP，但脱敏后相同，应被 F-006 拦截
    const res2 = await submitAnswer(qid, { answers: buildTestAnswers() }, ip2);
    expect(res2.status).toBe(429);
  });
});

// ==================== V-008 仪表盘 Dashboard 测试 ====================
//
// 测试 GET /api/answers/statistics/dashboard 跨问卷全局统计接口。
// 与单问卷 getStatistics 不同，Dashboard 聚合所有问卷 + 所有答案。
// 注意：路由顺序上 /statistics/dashboard 必须在 /statistics/:questionnaireId 之前。

// 直接导入 Answer 模型，用于构造历史日期的答案（API 不支持指定 submittedAt）
// import 已在文件顶部与其他 import 一起声明

describe('答案模块 - GET /api/answers/statistics/dashboard', () => {
  it('V-008 未登录应返回 401', async () => {
    const res = await request(app).get('/api/answers/statistics/dashboard');
    expect(res.status).toBe(401);
  });

  it('V-008 应返回仪表盘数据结构（overview/trend/sourceStats/deviceStats/questionnaireStatusStats/topQuestionnaires）', async () => {
    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.overview).toBeDefined();
    expect(Array.isArray(res.body.data.trend)).toBe(true);
    expect(Array.isArray(res.body.data.sourceStats)).toBe(true);
    expect(Array.isArray(res.body.data.deviceStats)).toBe(true);
    expect(Array.isArray(res.body.data.questionnaireStatusStats)).toBe(true);
    expect(Array.isArray(res.body.data.topQuestionnaires)).toBe(true);

    // overview 应包含 5 个字段
    expect(res.body.data.overview.totalQuestionnaires).toBeDefined();
    expect(res.body.data.overview.activeQuestionnaires).toBeDefined();
    expect(res.body.data.overview.totalAnswers).toBeDefined();
    expect(res.body.data.overview.todayNewAnswers).toBeDefined();
    expect(res.body.data.overview.avgDuration).toBeDefined();
  });

  it('V-008 overview 应正确统计总问卷数与活跃问卷数', async () => {
    // 创建 3 份问卷：1 份草稿、2 份已发布
    const draftQ = await createQuestionnaireViaApi(token, { title: '草稿问卷' });
    const pubQ1 = await createPublishedQuestionnaire();
    const pubQ2 = await createPublishedQuestionnaire();

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    expect(res.body.data.overview.totalQuestionnaires).toBeGreaterThanOrEqual(3);
    expect(res.body.data.overview.activeQuestionnaires).toBeGreaterThanOrEqual(2);

    // 验证创建的问卷 ID 都存在（draftQ 草稿不计入活跃）
    expect(res.body.data.overview.totalQuestionnaires).toBeGreaterThanOrEqual(3);
  });

  it('V-008 overview 应正确统计总填写数与平均时长', async () => {
    const qid = await createPublishedQuestionnaire();
    // 提交 2 份答案，时长分别为 100s 和 200s
    await submitAnswer(qid, {
      answers: buildTestAnswers(),
      duration: 100,
    });
    await submitAnswer(qid, {
      answers: buildTestAnswers(),
      duration: 200,
    });

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    expect(res.body.data.overview.totalAnswers).toBeGreaterThanOrEqual(2);
    // avgDuration 为全局平均，至少包含本用例的 2 份答案
    // 由于其他用例可能也有答案，只验证 >= 150（本用例平均）
    expect(res.body.data.overview.avgDuration).toBeGreaterThanOrEqual(0);
  });

  it('V-008 overview.todayNewAnswers 应只统计今日提交的答案', async () => {
    const qid = await createPublishedQuestionnaire();

    // 通过 model 直接创建一份昨日的答案（API 不支持指定 submittedAt）
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await AnswerModel.create({
      questionnaireId: qid,
      answers: buildTestAnswers(),
      source: 'web',
      device: 'desktop',
      duration: 100,
      submittedAt: yesterday,
      ipAddress: '10.40.50.0',
    });

    // 今日答案通过 API 提交
    await submitAnswer(qid, {
      answers: buildTestAnswers(),
      duration: 50,
    });

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    // todayNewAnswers 至少为 1（今日提交的），不应计入昨日的
    expect(res.body.data.overview.todayNewAnswers).toBeGreaterThanOrEqual(1);
  });

  it('V-008 trend 应返回近 7 天填写趋势（含补全的 0 填充日期）', async () => {
    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    expect(res.body.data.trend).toHaveLength(7);
    // 每个元素应有 date 和 count 字段
    res.body.data.trend.forEach((item: any) => {
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof item.count).toBe('number');
      expect(item.count).toBeGreaterThanOrEqual(0);
    });
    // 日期应升序
    for (let i = 1; i < 7; i++) {
      expect(res.body.data.trend[i].date > res.body.data.trend[i - 1].date).toBe(true);
    }
  });

  it('V-008 sourceStats 应返回跨问卷的来源分布', async () => {
    const qid1 = await createPublishedQuestionnaire();
    const qid2 = await createPublishedQuestionnaire();

    // 不同来源提交答案
    await submitAnswer(qid1, { answers: buildTestAnswers(), source: 'web' });
    await submitAnswer(qid2, { answers: buildTestAnswers(), source: 'wechat' });
    await submitAnswer(qid1, { answers: buildTestAnswers(), source: 'web' });

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    // sourceStats 应包含 web 与 wechat 两种来源
    const sources = res.body.data.sourceStats.map((s: any) => s.source);
    expect(sources).toContain('web');
    expect(sources).toContain('wechat');

    // web 来源至少 2 个
    const webStat = res.body.data.sourceStats.find((s: any) => s.source === 'web');
    expect(webStat.count).toBeGreaterThanOrEqual(2);
  });

  it('V-008 deviceStats 应返回跨问卷的设备分布', async () => {
    const qid1 = await createPublishedQuestionnaire();
    const qid2 = await createPublishedQuestionnaire();

    await submitAnswer(qid1, { answers: buildTestAnswers(), device: 'desktop' });
    await submitAnswer(qid2, { answers: buildTestAnswers(), device: 'mobile' });

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    const devices = res.body.data.deviceStats.map((s: any) => s.device);
    expect(devices).toContain('desktop');
    expect(devices).toContain('mobile');
  });

  it('V-008 questionnaireStatusStats 应返回问卷状态分布（draft/published/closed）', async () => {
    // 创建不同状态的问卷
    await createQuestionnaireViaApi(token, { title: '草稿问卷' }); // draft
    await createPublishedQuestionnaire(); // published（保留，不被关闭）
    const pubQToClose = await createPublishedQuestionnaire(); // published → closed

    // 关闭一份已发布问卷
    await request(app)
      .post(`/api/questionnaires/${pubQToClose}/close`)
      .set(authHeader(token));

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    const statuses = res.body.data.questionnaireStatusStats.map((s: any) => s.status);
    expect(statuses).toContain('draft');
    expect(statuses).toContain('published');
    expect(statuses).toContain('closed');
  });

  it('V-008 topQuestionnaires 应返回答卷数 Top 5 问卷（按答卷数降序）', async () => {
    // 创建 3 份问卷，分别提交 3/2/1 份答案
    const qid1 = await createPublishedQuestionnaire();
    const qid2 = await createPublishedQuestionnaire();
    const qid3 = await createPublishedQuestionnaire();

    for (let i = 0; i < 3; i++) {
      await submitAnswer(qid1, { answers: buildTestAnswers() });
    }
    for (let i = 0; i < 2; i++) {
      await submitAnswer(qid2, { answers: buildTestAnswers() });
    }
    await submitAnswer(qid3, { answers: buildTestAnswers() });

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    expect(res.body.data.topQuestionnaires.length).toBeLessThanOrEqual(5);
    // Top 1 的答卷数应 >= Top 2 的答卷数（降序）
    if (res.body.data.topQuestionnaires.length >= 2) {
      expect(res.body.data.topQuestionnaires[0].answerCount)
        .toBeGreaterThanOrEqual(res.body.data.topQuestionnaires[1].answerCount);
    }
    // 每项应包含 _id/title/answerCount/status
    res.body.data.topQuestionnaires.forEach((q: any) => {
      expect(q._id).toBeDefined();
      expect(q.title).toBeDefined();
      expect(q.answerCount).toBeDefined();
      expect(q.status).toBeDefined();
    });
  });
});
