/**
 * 用户数据模型 (User Model)
 * 
 * 功能说明：
 * - 存储系统用户信息
 * - 支持管理员和普通用户两种角色
 * - 密码使用bcrypt加密存储
 */

import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * 用户角色类型（U-006 三角色体系）
 *
 * - admin：管理员，完全权限，可管理所有问卷、用户、查看全部数据
 * - analyst：分析师，只读权限，可查看问卷列表/详情、统计、答案、导出、仪表盘
 * - editor：编辑者，可创建/编辑/删除自己的问卷、发布/关闭，但不能查看他人数据/统计/答案
 *
 * 历史兼容：旧数据中的 'user' 角色应在迁移时转为 'editor'（默认编辑权限）
 */
export type UserRole = 'admin' | 'analyst' | 'editor';

/**
 * 用户文档接口
 * 继承自 Document 以获得 Mongoose 文档的功能
 */
export interface IUser extends Document {
  username: string;          // 用户名（唯一）
  email: string;            // 邮箱（唯一）
  password: string;         // 密码（加密存储）
  role: UserRole;           // 角色：admin/analyst/editor（U-006）
  createdAt: Date;          // 创建时间
  updatedAt: Date;          // 更新时间

  /**
   * 密码比对方法
   * 用于验证用户登录时输入的密码
   * @param candidatePassword - 用户输入的明文密码
   * @returns Promise<boolean> - 密码是否匹配
   */
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * 用户Schema定义
 * 定义了用户数据的结构和验证规则
 */
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, '用户名不能为空'],
      unique: true,
      trim: true,
      minlength: [3, '用户名至少3个字符'],
      maxlength: [20, '用户名最多20个字符'],
    },
    email: {
      type: String,
      required: [true, '邮箱不能为空'],
      unique: true,
      trim: true,
      lowercase: true,  // 自动转换为小写
    },
    password: {
      type: String,
      required: [true, '密码不能为空'],
      minlength: [6, '密码至少6个字符'],
      select: false,   // 查询时默认不返回密码字段
    },
    role: {
      type: String,
      enum: {
        // U-006 三角色体系：admin/analyst/editor
        // 同时保留 'user' 用于旧数据兼容（注册时不再产生 user 角色）
        values: ['admin', 'analyst', 'editor', 'user'],
        message: '角色必须是 admin、analyst 或 editor'
      },
      default: 'editor',
    },
  },
  {
    timestamps: true,  // 自动添加 createdAt 和 updatedAt
  }
);

/**
 * 密码加密中间件
 * 在保存用户数据前自动加密密码
 * 
 * 执行时机：只有在密码被修改时才执行加密
 * 加密强度：salt rounds = 10
 */
userSchema.pre('save', async function (next) {
  // 如果密码没有修改，跳过加密
  if (!this.isModified('password')) return next();
  
  try {
    // 生成盐并加密密码
    // salt rounds 越高越安全，但计算越慢，通常使用10
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * 密码比对实例方法
 * 使用bcrypt.compare进行密码验证
 * 
 * @param candidatePassword - 用户登录时输入的明文密码
 * @returns Promise<boolean> - 密码匹配返回true，否则返回false
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  // bcrypt.compare 会自动处理盐的提取和比对
  return bcrypt.compare(candidatePassword, this.password);
};

// 创建用户模型
export const User = mongoose.model<IUser>('User', userSchema);