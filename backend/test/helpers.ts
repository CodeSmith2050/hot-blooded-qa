/**
 * 测试辅助工具
 *
 * 功能说明：
 * - 提供公共的测试数据构造方法
 * - 提供用户注册/登录并获取 token 的快捷方法
 * - 提供问卷创建的快捷方法
 * - 减少各测试文件中的重复代码
 */

import request from 'supertest';
import app from '../src/app';
import { Questionnaire } from '../src/models/Questionnaire';
import { Template } from '../src/models/Template';
import { presetTemplates } from '../src/data/templates';
import { User, UserRole } from '../src/models/User';

// ==================== 用户相关辅助 ====================

/**
 * 测试用户信息接口
 */
export interface TestUser {
  username: string;
  email: string;
  password: string;
  role?: string;
}

/**
 * 默认测试用户
 *
 * 注意：U-006 实施后，defaultUser 不携带 role 字段：
 *   - 直接走 /api/auth/register 时，注册接口默认分配 editor 角色
 *   - 通过 registerAndLogin(defaultUser) 时，helper 会将角色升级为 admin
 *     （因为现有测试默认需要 admin 权限覆盖所有管理操作）
 */
export const defaultUser: TestUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
};

/**
 * 注册并登录用户，返回 { userId, token, user }
 *
 * 行为说明（U-006 实施后）：
 *   - user.role === 'admin' 时：先走注册接口（得到 editor），再通过 Model 升级为 admin
 *     （因为注册接口禁止自选 admin，但测试需要 admin 角色覆盖管理操作）
 *   - user.role === 'analyst' / 'editor' 时：直接走注册接口
 *   - 未指定 user.role 时：默认升级为 admin（保持现有测试兼容）
 *
 * @param user 用户信息（可选，默认使用 defaultUser）
 */
export async function registerAndLogin(
  user: TestUser = defaultUser
): Promise<{ userId: string; token: string; user: any }> {
  // 1. 通过注册接口创建用户（注册接口仅允许 analyst/editor）
  //    发送 role: 'editor' 以绕过注册接口角色校验
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({
      ...user,
      role: 'editor',
    });

  // 注册失败时直接抛出，便于定位问题
  if (registerRes.status !== 201) {
    throw new Error(`注册失败: ${registerRes.status} ${JSON.stringify(registerRes.body)}`);
  }

  // 2. 若目标角色是 admin 或 analyst，通过 Model 直接更新角色
  //    （注册接口不允许自选这些角色，但测试需要覆盖三角色场景）
  const targetRole = user.role || 'admin';
  if (targetRole !== 'editor') {
    await User.findByIdAndUpdate(registerRes.body.user.id, { role: targetRole as UserRole });
  }

  // 3. 登录获取 token（此时角色已为目标角色）
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: user.username, password: user.password });

  if (loginRes.status !== 200) {
    throw new Error(`登录失败: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  return {
    userId: loginRes.body.user.id,
    token: loginRes.body.token,
    user: loginRes.body.user,
  };
}

/**
 * 构造带 Bearer token 的 Authorization 头
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

// ==================== 问卷相关辅助 ====================

/**
 * 构造一份测试用问卷题目列表（前端格式）
 */
export function buildTestQuestions(): any[] {
  return [
    {
      id: 'q1',
      type: 'single_choice',
      title: '您的性别是？',
      required: true,
      options: [
        { id: 'opt1', text: '男', score: 0 },
        { id: 'opt2', text: '女', score: 0 },
      ],
    },
    {
      id: 'q2',
      type: 'multiple_choice',
      title: '您献血的动机？',
      required: false,
      options: [
        { id: 'opt1', text: '帮助他人', score: 5 },
        { id: 'opt2', text: '免费体检', score: 3 },
      ],
    },
    {
      id: 'q3',
      type: 'text',
      title: '您的建议',
      required: false,
      placeholder: '请输入',
    },
    {
      id: 'q4',
      type: 'rating',
      title: '满意度评分',
      required: true,
      maxRating: 5,
    },
  ];
}

/**
 * 通过 API 创建一份测试问卷
 *
 * @param token 用户认证 token
 * @param overrides 覆盖字段（标题、描述等）
 * @returns 创建的问卷数据（含 _id）
 */
export async function createQuestionnaireViaApi(
  token: string,
  overrides: { title?: string; description?: string; questions?: any[] } = {}
): Promise<any> {
  const res = await request(app)
    .post('/api/questionnaires')
    .set(authHeader(token))
    .send({
      title: overrides.title || '测试问卷',
      description: overrides.description || '测试描述',
      questions: overrides.questions || buildTestQuestions(),
    });

  if (res.status !== 201) {
    throw new Error(`创建问卷失败: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.data;
}

/**
 * 直接通过 Model 创建问卷（用于测试准备，绕过 API）
 */
export async function createQuestionnaireViaModel(
  userId: string,
  overrides: { title?: string; status?: string; questions?: any[] } = {}
): Promise<any> {
  // 后端存储格式
  const questions = (overrides.questions || buildTestQuestions()).map((q, index) => ({
    id: q.id || `q_${index}`,
    type: q.type === 'single_choice' ? 'single' :
          q.type === 'multiple_choice' ? 'multiple' : q.type,
    title: q.title,
    required: q.required ?? false,
    options: q.options?.map((o: any) => (typeof o === 'string' ? o : o.text)),
    ratingMax: q.type === 'rating' ? (q.maxRating || 5) : undefined,
    order: index,
  }));

  const questionnaire = new Questionnaire({
    title: overrides.title || '模型测试问卷',
    description: '模型创建',
    questions,
    createdBy: userId,
    status: overrides.status || 'draft',
  });
  await questionnaire.save();
  return questionnaire;
}

// ==================== 模板相关辅助 ====================

/**
 * 初始化预设模板到数据库（用于模板相关测试）
 */
export async function initPresetTemplates(): Promise<any[]> {
  const docs = presetTemplates.map((t) => ({
    ...t,
    isSystem: true,
    usageCount: 0,
  }));
  return await Template.insertMany(docs);
}

/**
 * 构造一份有效答案数据（用于 answer 测试）
 */
export function buildTestAnswers(): any[] {
  return [
    { questionId: 'q1', value: '男' },
    { questionId: 'q2', value: ['帮助他人'] },
    { questionId: 'q3', value: '服务很好' },
    { questionId: 'q4', value: 5 },
  ];
}
