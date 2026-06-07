import mongoose, { Document, Schema } from 'mongoose';

// 答案值类型
export interface AnswerValue {
  questionId: string;
  value: string | string[] | number | Record<string, string>;
}

// 答案接口
export interface IAnswer extends Document {
  questionnaireId: mongoose.Types.ObjectId;
  answers: AnswerValue[];
  respondent?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  source: 'web' | 'wechat' | 'mobile';
  device: 'desktop' | 'mobile' | 'tablet';
  submittedAt: Date;
  duration: number; // 填写时长（秒）
}

// 答案Schema
const answerSchema = new Schema<IAnswer>(
  {
    questionnaireId: {
      type: Schema.Types.ObjectId,
      ref: 'Questionnaire',
      required: true,
    },
    answers: {
      type: [
        {
          questionId: { type: String, required: true },
          value: { type: Schema.Types.Mixed, required: true },
        },
      ],
      required: true,
    },
    respondent: {
      name: { type: String },
      phone: { type: String },
      email: { type: String },
    },
    source: {
      type: String,
      enum: ['web', 'wechat', 'mobile'],
      default: 'web',
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      default: 'desktop',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// 索引
answerSchema.index({ questionnaireId: 1, submittedAt: -1 });
answerSchema.index({ source: 1 });
answerSchema.index({ device: 1 });

export const Answer = mongoose.model<IAnswer>('Answer', answerSchema);