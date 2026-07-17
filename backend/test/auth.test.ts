/**
 * 认证模块 API 单元测试
 *
 * 测试范围（对应功能列表 U-001 ~ U-006）：
 * - POST /api/auth/register  用户注册
 * - POST /api/auth/login     用户登录
 * - GET  /api/auth/profile   获取当前用户信息
 * - 认证中间件鉴权场景
 * - U-006 角色权限控制（admin/analyst/editor 三角色）
 *
 * 关联 PRD：3.3 安全性需求 - 用户认证
 */

import request from 'supertest';
import app from '../src/app';
import { defaultUser, authHeader, registerAndLogin, buildTestQuestions, createQuestionnaireViaApi } from './helpers';

// ==================== 用户注册测试 ====================

describe('认证模块 - POST /api/auth/register', () => {
  it('U-001 应成功注册新用户，返回 token 和用户信息', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(defaultUser);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.username).toBe(defaultUser.username);
    expect(res.body.user.email).toBe(defaultUser.email);
    // 密码不应返回
    expect(res.body.user.password).toBeUndefined();
  });

  it('U-001 缺少用户名应返回 500 错误', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('U-001 重复用户名应返回 400 错误', async () => {
    // 先注册一次
    await registerAndLogin(defaultUser);

    // 同名再次注册应失败
    const res = await request(app)
      .post('/api/auth/register')
      .send(defaultUser);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('已被注册');
  });

  it('U-001 重复邮箱应返回 400 错误', async () => {
    await registerAndLogin(defaultUser);
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'anotheruser',
        email: defaultUser.email,
        password: 'password123',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ==================== 用户登录测试 ====================

describe('认证模块 - POST /api/auth/login', () => {
  beforeEach(async () => {
    // 每个用例前确保用户已注册
    await registerAndLogin(defaultUser);
  });

  it('U-002 正确用户名密码应登录成功并返回 token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: defaultUser.username, password: defaultUser.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe(defaultUser.username);
  });

  it('U-002 密码错误应返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: defaultUser.username, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('用户名或密码错误');
  });

  it('U-002 不存在的用户应返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nouser', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ==================== 获取用户信息测试 ====================

describe('认证模块 - GET /api/auth/profile', () => {
  it('U-005 携带有效 token 应返回当前用户信息', async () => {
    const { token, user } = await registerAndLogin(defaultUser);

    const res = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.username).toBe(defaultUser.username);
  });

  it('U-004 未携带 token 应返回 401', async () => {
    const res = await request(app).get('/api/auth/profile');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('认证令牌');
  });

  it('U-004 携带无效 token 应返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set(authHeader('invalid.token.here'));

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('U-004 token 格式错误（非 Bearer）应返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set({ Authorization: 'Basic abc123' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ==================== 健康检查与全局错误处理 ====================

describe('基础设施 - 健康检查与 404', () => {
  it('GET /health 应返回服务状态', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
  });

  it('GET 不存在的路由应返回 404', async () => {
    const res = await request(app).get('/api/not-exist');

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('路由不存在');
  });
});

// ==================== U-006 角色权限控制测试 ====================

/**
 * U-006 三角色体系测试
 *
 * 角色权限矩阵：
 *   - admin：完全权限
 *   - analyst：只读（问卷列表/详情、答案、统计、导出、仪表盘）
 *   - editor：问卷 CRUD（不能查看答案/统计/导出/仪表盘）
 *
 * 测试策略：
 *   1. 注册接口角色校验（默认 editor、允许 analyst、禁止 admin、拒绝非法）
 *   2. analyst 只读：可读，不能写
 *   3. editor 不能查看答案/统计/导出/仪表盘
 *   4. admin 全部权限
 */

describe('U-006 角色权限 - POST /api/auth/register 角色校验', () => {
  it('U-006 未指定 role 时应默认 editor', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_default',
        email: 'default@example.com',
        password: 'password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('editor');
  });

  it('U-006 允许自选 analyst 角色', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_analyst',
        email: 'analyst@example.com',
        password: 'password123',
        role: 'analyst',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('analyst');
  });

  it('U-006 允许自选 editor 角色', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_editor',
        email: 'editor@example.com',
        password: 'password123',
        role: 'editor',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('editor');
  });

  it('U-006 禁止自选 admin 角色（应返回 400）', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_admin',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('管理员');
  });

  it('U-006 拒绝非法 role 值', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'user_invalid',
        email: 'invalid@example.com',
        password: 'password123',
        role: 'superuser',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('U-006 角色权限 - analyst 只读场景', () => {
  it('U-006 analyst 可查看问卷列表', async () => {
    const { token } = await registerAndLogin({
      username: 'analyst_list',
      email: 'alist@example.com',
      password: 'password123',
      role: 'analyst',
    });

    const res = await request(app)
      .get('/api/questionnaires')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('U-006 analyst 不能创建问卷（应返回 403）', async () => {
    const { token } = await registerAndLogin({
      username: 'analyst_create',
      email: 'acreate@example.com',
      password: 'password123',
      role: 'analyst',
    });

    const res = await request(app)
      .post('/api/questionnaires')
      .set(authHeader(token))
      .send({
        title: '测试问卷',
        description: '描述',
        questions: buildTestQuestions(),
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('权限不足');
  });

  it('U-006 analyst 不能发布问卷（应返回 403）', async () => {
    // 先用 admin 创建一份草稿问卷
    const adminResult = await registerAndLogin({
      username: 'admin_for_publish',
      email: 'adminpub@example.com',
      password: 'password123',
      role: 'admin',
    });
    const created = await createQuestionnaireViaApi(adminResult.token);

    // analyst 尝试发布
    const analystResult = await registerAndLogin({
      username: 'analyst_publish',
      email: 'apub@example.com',
      password: 'password123',
      role: 'analyst',
    });

    const res = await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(analystResult.token));

    expect(res.status).toBe(403);
  });

  it('U-006 analyst 不能删除问卷（应返回 403）', async () => {
    const adminResult = await registerAndLogin({
      username: 'admin_for_delete',
      email: 'admindel@example.com',
      password: 'password123',
      role: 'admin',
    });
    const created = await createQuestionnaireViaApi(adminResult.token);

    const analystResult = await registerAndLogin({
      username: 'analyst_delete',
      email: 'adel@example.com',
      password: 'password123',
      role: 'analyst',
    });

    const res = await request(app)
      .delete(`/api/questionnaires/${created._id}`)
      .set(authHeader(analystResult.token));

    expect(res.status).toBe(403);
  });

  it('U-006 analyst 不能编辑问卷（应返回 403）', async () => {
    const adminResult = await registerAndLogin({
      username: 'admin_for_edit',
      email: 'adminedit@example.com',
      password: 'password123',
      role: 'admin',
    });
    const created = await createQuestionnaireViaApi(adminResult.token);

    const analystResult = await registerAndLogin({
      username: 'analyst_edit',
      email: 'aedit@example.com',
      password: 'password123',
      role: 'analyst',
    });

    const res = await request(app)
      .put(`/api/questionnaires/${created._id}`)
      .set(authHeader(analystResult.token))
      .send({ title: '被篡改的标题' });

    expect(res.status).toBe(403);
  });
});

describe('U-006 角色权限 - editor 数据查看限制', () => {
  /**
   * 辅助：以 editor 身份注册并尝试访问答案/统计/仪表盘接口
   * 期望全部返回 403
   */
  async function createEditorAndQuestionnaire(): Promise<{ editorToken: string; questionnaireId: string }> {
    // 用 admin 创建并发布一份问卷（保证有数据）
    const adminResult = await registerAndLogin({
      username: 'admin_setup',
      email: 'adminsetup@example.com',
      password: 'password123',
      role: 'admin',
    });
    const created = await createQuestionnaireViaApi(adminResult.token);
    await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(adminResult.token));

    // 注册 editor 用户
    const editorResult = await registerAndLogin({
      username: 'editor_view',
      email: 'eview@example.com',
      password: 'password123',
      role: 'editor',
    });

    return { editorToken: editorResult.token, questionnaireId: created._id };
  }

  it('U-006 editor 可创建问卷（写权限）', async () => {
    const { token } = await registerAndLogin({
      username: 'editor_create',
      email: 'ecreate@example.com',
      password: 'password123',
      role: 'editor',
    });

    const res = await request(app)
      .post('/api/questionnaires')
      .set(authHeader(token))
      .send({
        title: 'editor 的问卷',
        description: '描述',
        questions: buildTestQuestions(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('U-006 editor 不能查看答案列表（应返回 403）', async () => {
    const { editorToken, questionnaireId } = await createEditorAndQuestionnaire();

    const res = await request(app)
      .get(`/api/answers/${questionnaireId}`)
      .set(authHeader(editorToken));

    expect(res.status).toBe(403);
  });

  it('U-006 editor 不能查看答案详情（应返回 403）', async () => {
    const { editorToken, questionnaireId } = await createEditorAndQuestionnaire();

    const res = await request(app)
      .get(`/api/answers/${questionnaireId}/507f1f77bcf86cd799439011`)
      .set(authHeader(editorToken));

    expect(res.status).toBe(403);
  });

  it('U-006 editor 不能查看统计（应返回 403）', async () => {
    const { editorToken, questionnaireId } = await createEditorAndQuestionnaire();

    const res = await request(app)
      .get(`/api/answers/statistics/${questionnaireId}`)
      .set(authHeader(editorToken));

    expect(res.status).toBe(403);
  });

  it('U-006 editor 不能导出数据（应返回 403）', async () => {
    const { editorToken, questionnaireId } = await createEditorAndQuestionnaire();

    const res = await request(app)
      .get(`/api/answers/${questionnaireId}/export`)
      .set(authHeader(editorToken));

    expect(res.status).toBe(403);
  });

  it('U-006 editor 不能查看仪表盘（应返回 403）', async () => {
    const { editorToken } = await createEditorAndQuestionnaire();

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(editorToken));

    expect(res.status).toBe(403);
  });
});

describe('U-006 角色权限 - admin 全权限', () => {
  it('U-006 admin 可访问仪表盘', async () => {
    const { token } = await registerAndLogin({
      username: 'admin_dashboard',
      email: 'admindash@example.com',
      password: 'password123',
      role: 'admin',
    });

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('U-006 admin 可创建、发布、删除问卷', async () => {
    const { token } = await registerAndLogin({
      username: 'admin_full',
      email: 'adminfull@example.com',
      password: 'password123',
      role: 'admin',
    });

    // 创建
    const created = await createQuestionnaireViaApi(token);
    expect(created._id).toBeDefined();

    // 发布
    const publishRes = await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(token));
    expect(publishRes.status).toBe(200);

    // 删除
    const delRes = await request(app)
      .delete(`/api/questionnaires/${created._id}`)
      .set(authHeader(token));
    expect(delRes.status).toBe(200);
  });
});

describe('U-006 角色权限 - analyst 数据分析权限', () => {
  /**
   * 准备一份已发布且有答案的问卷，返回问卷 ID + analyst token
   */
  async function prepareDataAndAnalyst(): Promise<{ analystToken: string; questionnaireId: string }> {
    const adminResult = await registerAndLogin({
      username: 'admin_data_setup',
      email: 'admindata@example.com',
      password: 'password123',
      role: 'admin',
    });
    const created = await createQuestionnaireViaApi(adminResult.token);
    await request(app)
      .post(`/api/questionnaires/${created._id}/publish`)
      .set(authHeader(adminResult.token));

    // 提交 1 份答案
    await request(app)
      .post('/api/answers/submit')
      .set('X-Forwarded-For', '10.99.0.1')
      .send({
        questionnaireId: created._id,
        answers: [
          { questionId: 'q1', value: '男' },
          { questionId: 'q2', value: ['帮助他人'] },
          { questionId: 'q3', value: '不错' },
          { questionId: 'q4', value: 5 },
        ],
      });

    const analystResult = await registerAndLogin({
      username: 'analyst_data',
      email: 'analystdata@example.com',
      password: 'password123',
      role: 'analyst',
    });

    return { analystToken: analystResult.token, questionnaireId: created._id };
  }

  it('U-006 analyst 可查看答案列表', async () => {
    const { analystToken, questionnaireId } = await prepareDataAndAnalyst();

    const res = await request(app)
      .get(`/api/answers/${questionnaireId}`)
      .set(authHeader(analystToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('U-006 analyst 可查看统计', async () => {
    const { analystToken, questionnaireId } = await prepareDataAndAnalyst();

    const res = await request(app)
      .get(`/api/answers/statistics/${questionnaireId}`)
      .set(authHeader(analystToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('U-006 analyst 可导出数据', async () => {
    const { analystToken, questionnaireId } = await prepareDataAndAnalyst();

    const res = await request(app)
      .get(`/api/answers/${questionnaireId}/export`)
      .set(authHeader(analystToken));

    expect(res.status).toBe(200);
  });

  it('U-006 analyst 可查看仪表盘', async () => {
    const { analystToken } = await prepareDataAndAnalyst();

    const res = await request(app)
      .get('/api/answers/statistics/dashboard')
      .set(authHeader(analystToken));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
