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
 * 用户文档接口
 * 继承自 Document 以获得 Mongoose 文档的功能
 */
export interface IUser extends Document {
  username: string;          // 用户名（唯一）
  email: string;            // 邮箱（唯一）
  password: string;         // 密码（加密存储）
  role: 'admin' | 'user';   // 角色：admin-管理员，user-普通用户
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
        values: ['admin', 'user'],
        message: '角色必须是 admin 或 user'
      },
      default: 'user',
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