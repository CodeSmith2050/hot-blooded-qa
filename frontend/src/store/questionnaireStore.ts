/**
 * 问卷状态管理（Zustand）
 * 
 * 功能说明：
 * - 管理问卷列表数据
 * - 管理当前编辑的问卷
 * - 提供 CRUD 操作方法
 * 
 * 使用场景：
 * - 问卷列表页：获取列表、分页、搜索
 * - 问卷编辑页：保存草稿、发布
 */

import { create } from 'zustand';

/**
 * 问卷状态枚举
 */
export type QuestionnaireStatus = 'draft' | 'published' | 'closed';

/**
 * 问题类型枚举
 */
export type QuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'rating' | 'date';

/**
 * 问题选项接口
 */
interface QuestionOption {
  id: string;       // 选项ID
  text: string;     // 选项文本
  score?: number;   // 评分（可选）
}

/**
 * 问题接口
 */
interface Question {
  id: string;           // 问题ID
  type: QuestionType;   // 问题类型
  title: string;        // 问题标题
  required: boolean;    // 是否必填
  options?: QuestionOption[]; // 选项（选择题）
  placeholder?: string; // 占位提示（文本题）
  maxLength?: number;   // 最大长度（文本题）
}

/**
 * 问卷接口
 */
export interface Questionnaire {
  _id: string;                    // 问卷ID
  title: string;                  // 标题
  description?: string;           // 描述
  status: QuestionnaireStatus;    // 状态
  questions: Question[];          // 问题列表
  createdAt: string;              // 创建时间
  updatedAt: string;              // 更新时间
  answerCount?: number;           // 答案数量
  startDate?: string;             // 开始时间
  endDate?: string;               // 结束时间
}

/**
 * 问卷状态接口
 */
interface QuestionnaireState {
  // 状态
  questionnaires: Questionnaire[];  // 问卷列表
  currentQuestionnaire: Questionnaire | null;  // 当前问卷
  loading: boolean;                 // 加载状态
  error: string | null;             // 错误信息
  
  // 列表查询参数
  pagination: {
    page: number;      // 当前页
    limit: number;     // 每页数量
    total: number;     // 总数
  };
  searchQuery: string;              // 搜索关键词
  statusFilter: string;             // 状态筛选
  
  // 方法
  setQuestionnaires: (questionnaires: Questionnaire[]) => void;
  setCurrentQuestionnaire: (questionnaire: Questionnaire | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPagination: (pagination: Partial<QuestionnaireState['pagination']>) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  addQuestionnaire: (questionnaire: Questionnaire) => void;
  updateQuestionnaire: (id: string, data: Partial<Questionnaire>) => void;
  removeQuestionnaire: (id: string) => void;
}

/**
 * 创建问卷状态存储
 */
export const useQuestionnaireStore = create<QuestionnaireState>((set) => ({
  // 初始状态
  questionnaires: [],
  currentQuestionnaire: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },
  searchQuery: '',
  statusFilter: '',
  
  // 设置问卷列表
  setQuestionnaires: (questionnaires) =>
    set({ questionnaires }),
  
  // 设置当前问卷
  setCurrentQuestionnaire: (questionnaire) =>
    set({ currentQuestionnaire: questionnaire }),
  
  // 设置加载状态
  setLoading: (loading) =>
    set({ loading }),
  
  // 设置错误信息
  setError: (error) =>
    set({ error }),
  
  // 设置分页
  setPagination: (pagination) =>
    set((state) => ({
      pagination: { ...state.pagination, ...pagination }
    })),
  
  // 设置搜索关键词
  setSearchQuery: (searchQuery) =>
    set({ searchQuery, pagination: { page: 1, limit: 10, total: 0 } }),
  
  // 设置状态筛选
  setStatusFilter: (statusFilter) =>
    set({ statusFilter, pagination: { page: 1, limit: 10, total: 0 } }),
  
  // 添加问卷到列表
  addQuestionnaire: (questionnaire) =>
    set((state) => ({
      questionnaires: [questionnaire, ...state.questionnaires]
    })),
  
  // 更新列表中的问卷
  updateQuestionnaire: (id, data) =>
    set((state) => ({
      questionnaires: state.questionnaires.map((q) =>
        q._id === id ? { ...q, ...data } : q
      )
    })),
  
  // 从列表中移除问卷
  removeQuestionnaire: (id) =>
    set((state) => ({
      questionnaires: state.questionnaires.filter((q) => q._id !== id)
    })),
}));

export default useQuestionnaireStore;