/**
 * 认证模块 API 单元测试
 *
 * 测试范围（对应功能列表 U-001 ~ U-005）：
 * - POST /api/auth/register  用户注册
 * - POST /api/auth/login     用户登录
 * - GET  /api/auth/profile   获取当前用户信息
 * - 认证中间件鉴权场景
 *
 * 关联 PRD：3.3 安全性需求 - 用户认证
 */

import request from 'supertest';
import app from '../src/app';
import { defaultUser, authHeader, registerAndLogin } from './helpers';

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
