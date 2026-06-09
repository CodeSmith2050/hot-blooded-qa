/**
 * 问卷模板数据模型 (Template Model)
 * 
 * 功能说明：
 * - 存储预设的问卷模板
 * - 支持快速创建问卷
 * - 模板结构与问卷类似，但不包含状态和创建者信息
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * 问题类型枚举（与问卷一致）
 */
export type QuestionType = 'single' | 'multiple' | 'text' | 'rating' | 'matrix';

/**
 * 问题接口定义
 */
export interface ITemplateQuestion {
  id: string;                    // 问题唯一标识
  type: QuestionType;            // 问题类型
  title: string;                // 问题标题
  description?: string;          // 问题描述
  required: boolean;             // 是否必填
  options?: string[];            // 选项列表
  ratingMax?: number;            // 评分最大值
  matrixRows?: string[];         // 矩阵题行标题
  matrixCols?: string[];         // 矩阵题列标题
  order: number;                 // 问题顺序
}

/**
 * 模板文档接口
 */
export interface ITemplate extends Document {
  name: string;                  // 模板名称
  title: string;                 // 问卷标题（使用模板创建时的默认标题）
  description?: string;          // 问卷描述
  icon?: string;                 // 图标标识（用于UI展示）
  category: string;              // 模板分类（如满意度调研、活动反馈等）
  questions: ITemplateQuestion[]; // 问题列表
  usageCount: number;            // 使用次数
  isSystem: boolean;             // 是否为系统预设模板
  createdAt: Date;              // 创建时间
  updatedAt: Date;              // 更新时间
}

/**
 * 问题Schema
 */
const questionSchema = new Schema<ITemplateQuestion>(
  {
    id: {
      type: String,
      required: [true, '问题ID不能为空']
    },
    type: {
      type: String,
      required: [true, '问题类型不能为空'],
      enum: {
        values: ['single', 'multiple', 'text', 'rating', 'matrix'],
        message: '问题类型无效'
      }
    },
    title: {
      type: String,
      required: [true, '问题标题不能为空'],
      trim: true,
      maxlength: [200, '问题标题最多200个字符']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, '问题描述最多500个字符']
    },
    required: {
      type: Boolean,
      default: false
    },
    options: {
      type: [String]
    },
    ratingMax: {
      type: Number,
      default: 5,
      min: [1, '评分最大值至少为1'],
      max: [10, '评分最大值最多为10']
    },
    matrixRows: {
      type: [String]
    },
    matrixCols: {
      type: [String]
    },
    order: {
      type: Number,
      required: [true, '问题顺序不能为空'],
      min: [0, '问题顺序不能为负数']
    }
  },
  { _id: false }
);

/**
 * 模板Schema
 */
const templateSchema = new Schema<ITemplate>(
  {
    name: {
      type: String,
      required: [true, '模板名称不能为空'],
      trim: true,
      maxlength: [50, '模板名称最多50个字符']
    },
    title: {
      type: String,
      required: [true, '问卷标题不能为空'],
      trim: true,
      maxlength: [100, '问卷标题最多100个字符']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, '问卷描述最多500个字符']
    },
    icon: {
      type: String,
      default: 'file-text'
    },
    category: {
      type: String,
      required: [true, '模板分类不能为空'],
      trim: true
    },
    questions: {
      type: [questionSchema],
      required: [true, '模板必须包含问题'],
      validate: {
        validator: (questions: ITemplateQuestion[]) => questions && questions.length > 0,
        message: '模板至少需要一个问题'
      }
    },
    usageCount: {
      type: Number,
      default: 0
    },
    isSystem: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// ==================== 索引配置 ====================
templateSchema.index({ category: 1 });           // 按分类查询
templateSchema.index({ isSystem: 1 });           // 按是否系统模板查询
templateSchema.index({ name: 'text' });          // 全文搜索名称

// 创建模板模型
export const Template = mongoose.model<ITemplate>(
  'Template',
  templateSchema
);