/**
 * 答案模块 API 单元测试
 *
 * 测试范围（对应功能列表 D-001 ~ D-005, F-001）：
 * - POST /api/answers/submit                        提交问卷答案（公开）
 * - GET  /api/answers/:questionnaireId              答案列表（分页）
 * - GET  /api/answers/:questionnaireId/:answerId    答案详情
 * - GET  /api/answers/statistics/:questionnaireId   统计数据
 * - GET  /api/answers/:questionnaireId/export       导出答案数据（CSV/Excel）
 *
 * 关联 PRD：2.2.3 问卷填写模块、2.2.4 数据分析模块
 */

import request from 'supertest';
import app from '../src/app';
import {
  authHeader,
  registerAndLogin,
  createQuestionnaireViaApi,
  buildTestAnswers,
} from './helpers';

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

// ==================== 提交答案测试 ====================

describe('答案模块 - POST /api/answers/submit', () => {
  it('F-001 应成功提交已发布问卷的答案', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await request(app)
      .post('/api/answers/submit')
      .send({
        questionnaireId: qid,
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

    const res = await request(app)
      .post('/api/answers/submit')
      .send({
        questionnaireId: qid,
        answers: buildTestAnswers(),
      });

    expect(res.status).toBe(201);
  });

  it('F-001 草稿状态问卷应禁止提交', async () => {
    const created = await createQuestionnaireViaApi(token);

    const res = await request(app)
      .post('/api/answers/submit')
      .send({
        questionnaireId: created._id,
        answers: buildTestAnswers(),
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('未发布或已关闭');
  });

  it('F-001 不存在的问卷应返回 404', async () => {
    const res = await request(app)
      .post('/api/answers/submit')
      .send({
        questionnaireId: '507f1f77bcf86cd799439011',
        answers: buildTestAnswers(),
      });

    expect(res.status).toBe(404);
  });

  it('F-001 未指定 source/device 时应使用默认值', async () => {
    const qid = await createPublishedQuestionnaire();

    const res = await request(app)
      .post('/api/answers/submit')
      .send({
        questionnaireId: qid,
        answers: buildTestAnswers(),
      });

    expect(res.status).toBe(201);
  });
});

// ==================== 答案列表测试 ====================

describe('答案模块 - GET /api/answers/:questionnaireId', () => {
  it('D-001 应返回分页答案列表', async () => {
    const qid = await createPublishedQuestionnaire();

    // 提交 3 份答案
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/answers/submit')
        .send({ questionnaireId: qid, answers: buildTestAnswers() });
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
      await request(app)
        .post('/api/answers/submit')
        .send({ questionnaireId: qid, answers: buildTestAnswers() });
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
    const submitRes = await request(app)
      .post('/api/answers/submit')
      .send({ questionnaireId: qid, answers: buildTestAnswers() });
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

    // 提交多份不同来源的答案
    await request(app)
      .post('/api/answers/submit')
      .send({
        questionnaireId: qid,
        answers: buildTestAnswers(),
        source: 'web',
        device: 'desktop',
        duration: 100,
      });
    await request(app)
      .post('/api/answers/submit')
      .send({
        questionnaireId: qid,
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
});

// ==================== 导出数据测试 ====================

describe('答案模块 - GET /api/answers/:questionnaireId/export', () => {
  it('D-005 应成功导出 CSV 格式数据', async () => {
    const qid = await createPublishedQuestionnaire();

    // 提交 2 份答案
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/answers/submit')
        .send({
          questionnaireId: qid,
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
    await request(app)
      .post('/api/answers/submit')
      .send({ questionnaireId: qid, answers: buildTestAnswers() });

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
    await request(app)
      .post('/api/answers/submit')
      .send({ questionnaireId: qid, answers: buildTestAnswers() });

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
    await request(app)
      .post('/api/answers/submit')
      .send({ questionnaireId: qid, answers: multiAnswers });

    const res = await request(app)
      .get(`/api/answers/${qid}/export`)
      .query({ format: 'csv' })
      .set(authHeader(token));

    const noBom = res.text.replace(/^\ufeff/, '');
    // 第二行（数据行）应包含多选题的 "|" 分隔符
    expect(noBom.split('\n')[1]).toContain('|');
  });
});
