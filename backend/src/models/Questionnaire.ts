/**
 * 问卷数据模型 (Questionnaire Model)
 * 
 * 功能说明：
 * - 存储问卷基本信息（标题、描述、状态等）
 * - 存储问卷问题列表
 * - 支持多种题型：单选、多选、填空、评分、矩阵
 * - 支持三种状态：草稿、已发布、已关闭
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * 问题类型枚举
 * - single: 单选题
 * - multiple: 多选题
 * - text: 填空题
 * - rating: 评分题
 * - matrix: 矩阵题
 */
export type QuestionType = 'single' | 'multiple' | 'text' | 'rating' | 'matrix';

/**
 * 问题接口定义
 * 描述问卷中单个问题的结构
 */
export interface IQuestion {
  id: string;                    // 问题唯一标识（UUID）
  type: QuestionType;            // 问题类型
  title: string;                // 问题标题
  description?: string;          // 问题描述/补充说明
  required: boolean;             // 是否必填
  options?: string[];            // 选项列表（用于单选/多选题）
  ratingMax?: number;            // 评分最大值（用于评分题，默认5）
  matrixRows?: string[];         // 矩阵题行标题
  matrixCols?: string[];         // 矩阵题列标题
  order: number;                 // 问题顺序
}

/**
 * 问卷状态枚举
 * - draft: 草稿状态，可编辑
 * - published: 已发布状态，可填写
 * - closed: 已关闭状态，停止收集
 */
export type QuestionnaireStatus = 'draft' | 'published' | 'closed';

/**
 * 问卷文档接口
 */
export interface IQuestionnaire extends Document {
  title: string;                // 问卷标题
  description?: string;         // 问卷描述
  questions: IQuestion[];       // 问题列表
  status: QuestionnaireStatus;  // 问卷状态
  createdBy: mongoose.Types.ObjectId;  // 创建者ID
  createdAt: Date;              // 创建时间
  updatedAt: Date;              // 更新时间
  publishedAt?: Date;           // 发布时间
  closedAt?: Date;              // 关闭时间
}

/**
 * 问题Schema
 * _id: false 表示不自动生成_id，因为问题有自定义的id字段
 */
const questionSchema = new Schema<IQuestion>(
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
      type: [String],
      // 只有单选/多选题需要选项
      validate: {
        validator: function(this: IQuestion, options?: string[]) {
          if (this.type === 'single' || this.type === 'multiple') {
            return options && options.length >= 2;
          }
          return true;
        },
        message: '单选/多选题至少需要2个选项'
      }
    },
    ratingMax: {
      type: Number,
      default: 5,
      min: [1, '评分最大值至少为1'],
      max: [10, '评分最大值最多为10']
    },
    matrixRows: {
      type: [String],
      // 只有矩阵题需要行标题
      validate: {
        validator: function(this: IQuestion, rows?: string[]) {
          if (this.type === 'matrix') {
            return rows && rows.length >= 2;
          }
          return true;
        },
        message: '矩阵题至少需要2行'
      }
    },
    matrixCols: {
      type: [String],
      // 只有矩阵题需要列标题
      validate: {
        validator: function(this: IQuestion, cols?: string[]) {
          if (this.type === 'matrix') {
            return cols && cols.length >= 2;
          }
          return true;
        },
        message: '矩阵题至少需要2列'
      }
    },
    order: {
      type: Number,
      required: [true, '问题顺序不能为空'],
      min: [0, '问题顺序不能为负数']
    }
  },
  { _id: false }  // 不自动生成_id
);

/**
 * 问卷Schema
 */
const questionnaireSchema = new Schema<IQuestionnaire>(
  {
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
    questions: {
      type: [questionSchema],
      required: [true, '问卷必须包含问题'],
      // 至少需要一个问题
      validate: {
        validator: (questions: IQuestion[]) => questions && questions.length > 0,
        message: '问卷至少需要一个问题'
      }
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'closed'],
        message: '问卷状态无效'
      },
      default: 'draft'
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, '创建者ID不能为空']
    },
    publishedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    }
  },
  {
    timestamps: true  // 自动添加 createdAt 和 updatedAt
  }
);

// ==================== 索引配置 ====================
// 索引可加速查询，类似于数据库的书签

questionnaireSchema.index({ status: 1 });                    // 按状态查询
questionnaireSchema.index({ createdBy: 1 });                 // 按创建者查询
questionnaireSchema.index({ createdAt: -1 });                // 按创建时间降序查询

// 创建问卷模型
export const Questionnaire = mongoose.model<IQuestionnaire>(
  'Questionnaire',
  questionnaireSchema
);