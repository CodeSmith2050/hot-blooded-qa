/**
 * 模板模块 API 单元测试
 *
 * 测试范围（对应功能列表 T-001 ~ T-005）：
 * - GET  /api/templates                获取模板列表（公开）
 * - GET  /api/templates/:id            获取模板详情（公开）
 * - POST /api/templates/:id/create     基于模板创建问卷（需登录）
 * - POST /api/templates/init           初始化预设模板（需登录）
 *
 * 关联 PRD：2.2.1 模板导入（提高问卷创建效率）
 */

import request from 'supertest';
import app from '../src/app';
import {
  authHeader,
  registerAndLogin,
  initPresetTemplates,
} from './helpers';

// ==================== 公共变量 ====================

let token: string;
let userId: string;

beforeAll(async () => {
  const result = await registerAndLogin();
  token = result.token;
  userId = result.userId;
});

// ==================== 初始化预设模板测试 ====================

describe('模板模块 - POST /api/templates/init', () => {
  it('T-002 应成功初始化预设模板', async () => {
    const res = await request(app)
      .post('/api/templates/init')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
  });

  it('T-002 重复初始化应返回已存在', async () => {
    await initPresetTemplates();

    const res = await request(app)
      .post('/api/templates/init')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('已存在');
  });

  it('T-002 未登录应返回 401', async () => {
    const res = await request(app).post('/api/templates/init');
    expect(res.status).toBe(401);
  });
});

// ==================== 获取模板列表测试 ====================

describe('模板模块 - GET /api/templates', () => {
  beforeEach(async () => {
    await initPresetTemplates();
  });

  it('T-003 应返回所有模板（公开访问）', async () => {
    const res = await request(app).get('/api/templates');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('T-003 支持按分类筛选', async () => {
    // 先获取全量，得到第一个分类
    const allRes = await request(app).get('/api/templates');
    const firstCategory = allRes.body.data[0].category;

    const res = await request(app).get('/api/templates').query({
      category: firstCategory,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((t: any) => t.category === firstCategory)
    ).toBe(true);
  });

  it('T-003 无需登录即可访问', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).not.toBe(401);
  });
});

// ==================== 获取模板详情测试 ====================

describe('模板模块 - GET /api/templates/:id', () => {
  it('T-004 应返回指定模板详情', async () => {
    await initPresetTemplates();
    const listRes = await request(app).get('/api/templates');
    const templateId = listRes.body.data[0]._id;

    const res = await request(app).get(`/api/templates/${templateId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(templateId);
    expect(res.body.data.questions).toBeDefined();
    expect(res.body.data.questions.length).toBeGreaterThan(0);
  });

  it('T-004 不存在的模板应返回 404', async () => {
    const res = await request(app).get(
      '/api/templates/507f1f77bcf86cd799439011'
    );
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ==================== 基于模板创建问卷测试 ====================

describe('模板模块 - POST /api/templates/:id/create', () => {
  it('T-005 应基于模板成功创建问卷', async () => {
    await initPresetTemplates();
    const listRes = await request(app).get('/api/templates');
    const templateId = listRes.body.data[0]._id;

    const res = await request(app)
      .post(`/api/templates/${templateId}/create`)
      .set(authHeader(token))
      .send({ title: '从模板创建', description: '自定义描述' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('从模板创建');
    expect(res.body.data.description).toBe('自定义描述');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.createdBy).toBeDefined();
    // 应包含模板中的问题
    expect(res.body.data.questions.length).toBeGreaterThan(0);
  });

  it('T-005 不传 title 时应使用模板默认标题', async () => {
    await initPresetTemplates();
    const listRes = await request(app).get('/api/templates');
    const template = listRes.body.data[0];

    const res = await request(app)
      .post(`/api/templates/${template._id}/create`)
      .set(authHeader(token))
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(template.title);
  });

  it('T-005 创建后应将模板使用次数 +1', async () => {
    await initPresetTemplates();
    const listRes = await request(app).get('/api/templates');
    const template = listRes.body.data[0];
    const beforeCount = template.usageCount;

    await request(app)
      .post(`/api/templates/${template._id}/create`)
      .set(authHeader(token))
      .send({});

    const afterRes = await request(app).get(
      `/api/templates/${template._id}`
    );
    expect(afterRes.body.data.usageCount).toBe(beforeCount + 1);
  });

  it('T-005 未登录应返回 401', async () => {
    await initPresetTemplates();
    const listRes = await request(app).get('/api/templates');
    const templateId = listRes.body.data[0]._id;

    const res = await request(app)
      .post(`/api/templates/${templateId}/create`)
      .send({});

    expect(res.status).toBe(401);
  });

  it('T-005 不存在的模板应返回 404', async () => {
    const res = await request(app)
      .post('/api/templates/507f1f77bcf86cd799439011/create')
      .set(authHeader(token))
      .send({});

    expect(res.status).toBe(404);
  });
});
