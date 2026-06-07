/**
 * 答案数据模型 (Answer Model)
 * 
 * 功能说明：
 * - 存储用户提交的问卷答案
 * - 记录提交来源（网页/微信/移动端）
 * - 记录填写时长等辅助信息
 */

import mongoose, { Document, Schema } from 'mongoose';

/**
 * 单个问题的答案
 */
export interface AnswerValue {
  questionId: string;                              // 问题ID（对应Questionnaire中的问题）
  value: string | string[] | number | Record<string, string>;  // 答案值，类型根据问题类型变化
  // - 单选题: string
  // - 多选题: string[]
  // - 填空题: string
  // - 评分题: number
  // - 矩阵题: Record<string, string> (key为行标题，value为列选择)
}

/**
 * 回答者信息（可选）
 * 用于收集填写者的联系信息
 */
export interface IRespondent {
  name?: string;    // 姓名
  phone?: string;   // 电话
  email?: string;   // 邮箱
}

/**
 * 答案来源枚举
 * - web: 网页端
 * - wechat: 微信端
 * - mobile: 移动端H5
 */
export type AnswerSource = 'web' | 'wechat' | 'mobile';

/**
 * 设备类型枚举
 * - desktop: 台式机/笔记本
 * - mobile: 手机
 * - tablet: 平板
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

/**
 * 答案文档接口
 */
export interface IAnswer extends Document {
  questionnaireId: mongoose.Types.ObjectId;   // 关联的问卷ID
  answers: AnswerValue[];                     // 答案列表
  respondent?: IRespondent;                   // 回答者信息
  source: AnswerSource;                        // 提交来源
  device: DeviceType;                         // 设备类型
  submittedAt: Date;                          // 提交时间
  duration: number;                            // 填写时长（秒）
}

/**
 * 答案Schema
 */
const answerSchema = new Schema<IAnswer>(
  {
    questionnaireId: {
      type: Schema.Types.ObjectId,
      ref: 'Questionnaire',
      required: [true, '问卷ID不能为空'],
      index: true  // 添加索引，加速按问卷查询
    },
    answers: {
      type: [
        {
          questionId: {
            type: String,
            required: [true, '问题ID不能为空']
          },
          value: {
            type: Schema.Types.Mixed,  // Mixed类型允许任意值
            required: [true, '答案值不能为空']
          }
        }
      ],
      required: [true, '答案列表不能为空'],
      validate: {
        validator: (answers: AnswerValue[]) => answers && answers.length > 0,
        message: '答案列表不能为空'
      }
    },
    respondent: {
      name: {
        type: String,
        trim: true,
        maxlength: [50, '姓名最多50个字符']
      },
      phone: {
        type: String,
        trim: true,
        // 简单的手机号验证（可改为更严格的正则）
        match: [/^1[3-9]\d{9}$/, '请输入有效的手机号']
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        // 邮箱格式验证
        match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱']
      }
    },
    source: {
      type: String,
      enum: {
        values: ['web', 'wechat', 'mobile'],
        message: '来源类型无效'
      },
      default: 'web'
    },
    device: {
      type: String,
      enum: {
        values: ['desktop', 'mobile', 'tablet'],
        message: '设备类型无效'
      },
      default: 'desktop'
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, '填写时长不能为负数'],
      // 单位：秒
      // 通常通过前端计时器计算：提交时间 - 开始填写时间
    }
  },
  {
    timestamps: true  // 自动添加 createdAt 和 updatedAt
  }
);

// ==================== 索引配置 ====================

// 复合索引：加速按问卷和时间排序查询
answerSchema.index({ questionnaireId: 1, submittedAt: -1 });

// 单字段索引：按来源统计
answerSchema.index({ source: 1 });

// 单字段索引：按设备类型统计
answerSchema.index({ device: 1 });

// 创建答案模型
export const Answer = mongoose.model<IAnswer>('Answer', answerSchema);