import mongoose, { Document, Schema } from 'mongoose';

// 问题类型
export type QuestionType = 'single' | 'multiple' | 'text' | 'rating' | 'matrix';

// 问题接口
export interface IQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required: boolean;
  options?: string[]; // 单选/多选题的选项
  ratingMax?: number; // 评分题的最大值
  matrixRows?: string[]; // 矩阵题的行
  matrixCols?: string[]; // 矩阵题的列
  order: number;
}

// 问卷接口
export interface IQuestionnaire extends Document {
  title: string;
  description?: string;
  questions: IQuestion[];
  status: 'draft' | 'published' | 'closed';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  closedAt?: Date;
}

// 问题Schema
const questionSchema = new Schema<IQuestion>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['single', 'multiple', 'text', 'rating', 'matrix'], required: true },
    title: { type: String, required: true },
    description: { type: String },
    required: { type: Boolean, default: false },
    options: { type: [String] },
    ratingMax: { type: Number },
    matrixRows: { type: [String] },
    matrixCols: { type: [String] },
    order: { type: Number, required: true },
  },
  { _id: false }
);

// 问卷Schema
const questionnaireSchema = new Schema<IQuestionnaire>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    questions: {
      type: [questionSchema],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    publishedAt: { type: Date },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// 索引
questionnaireSchema.index({ status: 1 });
questionnaireSchema.index({ createdBy: 1 });
questionnaireSchema.index({ createdAt: -1 });

export const Questionnaire = mongoose.model<IQuestionnaire>('Questionnaire', questionnaireSchema);