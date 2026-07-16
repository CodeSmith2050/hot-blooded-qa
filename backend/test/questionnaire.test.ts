/**
 * 问卷管理模块 API 单元测试
 *
 * 测试范围（对应功能列表 Q-001 ~ Q-008, E-001 ~ E-005）：
 * - GET    /api/questionnaires          问卷列表（分页、搜索、状态筛选）
 * - GET    /api/questionnaires/:id      问卷详情
 * - GET    /api/questionnaires/public/:id 公开访问已发布问卷
 * - POST   /api/questionnaires          创建问卷
 * - PUT    /api/questionnaires/:id      更新问卷（仅草稿可编辑）
 * - DELETE /api/questionnaires/:id      删除问卷
 * - POST   /api/questionnaires/:id/publish 发布问卷
 * - POST   /api/questionnaires/:id/close   关闭问卷
 * - POST   /api/questionnaires/import   导入问卷
 *
 * 关联 PRD：2.2.1 问卷管理模块、2.2.2 问卷编辑器
 */

import request from 'supertest';
import app from '../src/app';
import {
  authHeader,
  registerAndLogin,
  createQuestionnaireViaApi,
  buildTestQuestions,
} from './helpers';

// ==================== 测试公共数据 ====================

let token: string;
let userId: string;

beforeAll(async () => {
  const result = await registerAndLogin();
  token = result.token;
  userId = result.userId;
});

// ==================== 创建问卷测试 ====================

describe('问卷管理 - POST /api/questionnaires', () => {
  it('Q-003 应成功创建问卷，状态为 draft', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .set(authHeader(token))
      .send({
        title: '新问卷',
        description: '描述',
        questions: buildTestQuestions(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('新问卷');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.questions).toHaveLength(4);
    // 验证题型映射：前端 single_choice -> 后端 single
    expect(res.body.data.questions[0].type).toBe('single_choice');
  });

  it('Q-003 未登录应返回 401', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .send({ title: 'x', questions: buildTestQuestions() });

    expect(res.status).toBe(401);
  });

  it('Q-003 缺少标题应创建失败', async () => {
    const res = await request(app)
      .post('/api/questionnaires')
      .set(authHeader(token))
      .send({ questions: buildTestQuestions() });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ==================== 问卷列表测试 ====================

describe('问卷管理 - GET /api/questionnaires', () => {
  beforeEach(async () => {
    // 每个用例前准备 3 份问卷
    await createQuestionnaireViaApi(token, { title: '问卷A' });
    await createQuestionnaireViaApi(token, { title: '问卷B' });
    await createQuestionnaireViaApi(token, { title: '其他' });
  });

  it('Q-001 应返回分页列表', async () => {
    const res = await request(app)
      .get('/api/questionnaires')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.page).toBe(1);
  });

  it('Q-001 支持按关键词搜索', async () => {
    const res = await request(app)
      .get('/api/questionnaires')
      .query({ search: '问卷' })
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((q: any) => q.title.includes('问卷'))).toBe(true);
  });

  it('Q-001 支持分页参数', async () => {
    const res = await request(app)
      .get('/api/questionnaires')
      .query({ page: 1, limit: 2 })
      .set(authHeader(token));

    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it('Q-001 支持状态筛选', async () => {
    const res = await request(app)
      .get('/api/questionnaires')
      .query({ status: 'published' })
      .set(authHeader(token));

    // 全部为草稿，published 应为 0
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.total).toBe(0);
  });

  it('Q-001 未登录应返回 401', async () => {
    const res = await request(app).get('/api/questionnaires');
    expect(res.status).toBe(401);
  });
});

// ==================== 问卷详情测试 ====================

describe('问卷管理 - GET /api/questionnaires/:id', () => {
  it('Q-002 应返回指定问卷详情', async () => {
    const created = await createQuestionnaireViaApi(token);

    const res = await request(app)
      .get(`/api/questionnaires/${created._id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(created._id);
    expect(res.body.data.title).toBe(created.title);
  });

  it('Q-002 不存在的 ID 应返回 404', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app)
      .get(`/api/questionnaires/${fakeId}`)
      .set(authHeader(token));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ==================== 公开访问测试 ====================

describe('问卷管理 - GET /api/questionnaires/public/:id', () => {
  it('Q-008 应允许未登录用户访问已发布问卷', async () => {
    const created = await createQuestionnaireViaApi(token);

    // 发布问卷
    await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(token));

    // 未登录访问公开接口
    const res = await request(app).get(
      `/api/questionnaires/public/${created._id}`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(created._id);
  });

  it('Q-008 草稿状态问卷公开访问仍可读取（接口未限制状态）', async () => {
    // 注：当前实现公开接口未校验 status，记录此行为
    const created = await createQuestionnaireViaApi(token);
    const res = await request(app).get(
      `/api/questionnaires/public/${created._id}`
    );

    expect(res.status).toBe(200);
  });

  it('Q-008 不存在的问卷应返回 404', async () => {
    const res = await request(app).get(
      '/api/questionnaires/public/507f1f77bcf86cd799439011'
    );
    expect(res.status).toBe(404);
  });
});

// ==================== 更新问卷测试 ====================

describe('问卷管理 - PUT /api/questionnaires/:id', () => {
  it('Q-004 草稿状态应允许更新', async () => {
    const created = await createQuestionnaireViaApi(token);

    const res = await request(app)
      .put(`/api/questionnaires/${created._id}`)
      .set(authHeader(token))
      .send({ title: '更新后的标题' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('更新后的标题');
  });

  it('Q-004 已发布问卷应禁止更新', async () => {
    const created = await createQuestionnaireViaApi(token);
    await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(token));

    const res = await request(app)
      .put(`/api/questionnaires/${created._id}`)
      .set(authHeader(token))
      .send({ title: '试图修改' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('草稿状态');
  });
});

// ==================== 删除问卷测试 ====================

describe('问卷管理 - DELETE /api/questionnaires/:id', () => {
  it('Q-005 应成功删除问卷', async () => {
    const created = await createQuestionnaireViaApi(token);

    const res = await request(app)
      .delete(`/api/questionnaires/${created._id}`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 删除后查询应 404
    const getRes = await request(app)
      .get(`/api/questionnaires/${created._id}`)
      .set(authHeader(token));
    expect(getRes.status).toBe(404);
  });

  it('Q-005 删除不存在的问卷应返回 404', async () => {
    const res = await request(app)
      .delete('/api/questionnaires/507f1f77bcf86cd799439011')
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });
});

// ==================== 发布与关闭测试 ====================

describe('问卷管理 - 发布与关闭状态机', () => {
  it('Q-006 草稿问卷应能发布，状态变为 published', async () => {
    const created = await createQuestionnaireViaApi(token);

    const res = await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).toBeDefined();
  });

  it('Q-006 已发布问卷不能再次发布', async () => {
    const created = await createQuestionnaireViaApi(token);
    await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(token));

    const res = await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('草稿状态');
  });

  it('Q-007 已发布问卷应能关闭，状态变为 closed', async () => {
    const created = await createQuestionnaireViaApi(token);
    await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(token));

    const res = await request(app)
      .post(`/api/questionnaires/${created._id}/close`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('closed');
    expect(res.body.data.closedAt).toBeDefined();
  });

  it('Q-007 草稿问卷不能直接关闭', async () => {
    const created = await createQuestionnaireViaApi(token);

    const res = await request(app)
      .post(`/api/questionnaires/${created._id}/close`)
      .set(authHeader(token));

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('已发布');
  });
});

// ==================== 导入问卷测试 ====================

describe('问卷管理 - POST /api/questionnaires/import', () => {
  it('Q-009 应成功导入合法 JSON 问卷', async () => {
    const res = await request(app)
      .post('/api/questionnaires/import')
      .set(authHeader(token))
      .send({
        title: '导入问卷',
        description: '导入描述',
        questions: buildTestQuestions(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('导入问卷');
  });

  it('Q-009 标题为空应返回 400', async () => {
    const res = await request(app)
      .post('/api/questionnaires/import')
      .set(authHeader(token))
      .send({ title: '', questions: buildTestQuestions() });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('标题');
  });

  it('Q-009 questions 非数组应返回 400', async () => {
    const res = await request(app)
      .post('/api/questionnaires/import')
      .set(authHeader(token))
      .send({ title: 'x', questions: 'not-array' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('数组');
  });

  it('Q-009 选择题选项少于 2 个应返回 400', async () => {
    const res = await request(app)
      .post('/api/questionnaires/import')
      .set(authHeader(token))
      .send({
        title: 'x',
        questions: [
          {
            type: 'single_choice',
            title: '单选',
            options: [{ text: '唯一选项' }],
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('2个选项');
  });

  it('Q-009 无效题型应返回 400', async () => {
    const res = await request(app)
      .post('/api/questionnaires/import')
      .set(authHeader(token))
      .send({
        title: 'x',
        questions: [{ type: 'invalid_type', title: 't' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('类型无效');
  });
});
