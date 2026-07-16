/**
 * API 服务层
 * 
 * 功能说明：
 * - 封装 Axios 实例，统一配置
 * - 请求拦截器：自动添加认证令牌
 * - 响应拦截器：统一错误处理
 * - 提供各模块的 API 调用方法
 * 
 * 使用方式：
 * import { questionnaireApi, authApi } from '@/services/api';
 * const data = await questionnaireApi.getList();
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// ==================== Axios 实例配置 ====================

/**
 * 创建 Axios 实例
 * baseURL 通过 Vite 代理转发到后端
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',              // 基础路径（Vite 代理会转发到后端）
  timeout: 10000,               // 请求超时时间（毫秒）
  headers: {
    'Content-Type': 'application/json',
  }
});

// ==================== 请求拦截器 ====================

/**
 * 请求拦截器
 * 
 * 功能：
 * - 从 localStorage 读取 JWT 令牌
 * - 自动添加到请求头的 Authorization 字段
 * - 格式：Bearer <token>
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从本地存储获取认证令牌
    const token = localStorage.getItem('token');
    
    if (token && config.headers) {
      // 添加认证头
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    // 请求发送失败
    return Promise.reject(error);
  }
);

// ==================== 响应拦截器 ====================

/**
 * 响应拦截器
 * 
 * 功能：
 * - 统一错误处理
 * - 处理 401 未授权（令牌过期）
 * - 提取响应数据
 */
apiClient.interceptors.response.use(
  (response) => {
    // 直接返回响应数据
    return response.data;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;
      
      switch (status) {
        case 401:
          // 未授权：清除令牌并跳转到登录页
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          break;
          
        case 403:
          // 禁止访问
          console.error('权限不足:', data?.message);
          break;
          
        case 404:
          // 资源不存在
          console.error('资源不存在:', data?.message);
          break;
          
        case 500:
          // 服务器错误
          console.error('服务器错误:', data?.message);
          break;
          
        default:
          console.error('请求错误:', data?.message || error.message);
      }
    } else if (error.request) {
      // 请求已发送但未收到响应（网络错误）
      console.error('网络错误，请检查网络连接');
    } else {
      // 请求配置错误
      console.error('请求配置错误:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// ==================== 认证相关 API ====================

/**
 * 认证 API
 * 处理用户登录、注册、信息获取
 */
export const authApi = {
  /**
   * 用户登录
   * @param credentials 登录凭证（用户名/邮箱 + 密码）
   */
  login: (credentials: { username: string; password: string }) =>
    apiClient.post('/auth/login', credentials),
  
  /**
   * 用户注册
   * @param data 注册信息
   */
  register: (data: { username: string; email: string; password: string; role?: string }) =>
    apiClient.post('/auth/register', data),
  
  /**
   * 获取当前用户信息
   */
  getProfile: () =>
    apiClient.get('/auth/profile'),
};

// ==================== 问卷相关 API ====================

/**
 * 问卷 API
 * 处理问卷的增删改查、发布、统计
 */
export const questionnaireApi = {
  /**
   * 获取问卷列表
   * @param params 查询参数（分页、搜索、筛选）
   */
  getList: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    apiClient.get('/questionnaires', { params }),
  
  /**
   * 获取单个问卷详情
   * @param id 问卷ID
   */
  getById: (id: string) =>
    apiClient.get(`/questionnaires/${id}`),
  
  /**
   * 创建问卷
   * @param data 问卷数据
   */
  create: (data: any) =>
    apiClient.post('/questionnaires', data),
  
  /**
   * 更新问卷
   * @param id 问卷ID
   * @param data 更新数据
   */
  update: (id: string, data: any) =>
    apiClient.put(`/questionnaires/${id}`, data),
  
  /**
   * 删除问卷
   * @param id 问卷ID
   */
  delete: (id: string) =>
    apiClient.delete(`/questionnaires/${id}`),
  
  /**
   * 发布问卷
   * @param id 问卷ID
   */
  publish: (id: string) =>
    apiClient.post(`/questionnaires/${id}/publish`),
  
  /**
   * 关闭问卷
   * @param id 问卷ID
   */
  close: (id: string) =>
    apiClient.post(`/questionnaires/${id}/close`),
  
  /**
   * 获取问卷统计
   * @param id 问卷ID
   */
  getStatistics: (id: string) =>
    apiClient.get(`/questionnaires/${id}/statistics`),
  
  /**
   * 导入问卷
   * @param data 问卷JSON数据
   */
  import: (data: {
    title: string;
    description?: string;
    questions: Array<{
      type: string;
      title: string;
      required?: boolean;
      options?: Array<{ text: string; score?: number }>;
      placeholder?: string;
      maxLength?: number;
      maxRating?: number;
    }>;
  }) =>
    apiClient.post('/questionnaires/import', data),
};

// ==================== 答案相关 API ====================

/**
 * 答案 API
 * 处理问卷答案的提交和查询
 */
export const answerApi = {
  /**
   * 提交答案
   * @param questionnaireId 问卷ID
   * @param data 答案数据
   */
  submit: (questionnaireId: string, data: any) =>
    apiClient.post(`/answers/${questionnaireId}`, data),
  
  /**
   * 获取答案列表
   * @param questionnaireId 问卷ID
   * @param params 查询参数
   */
  getList: (questionnaireId: string, params?: { page?: number; limit?: number }) =>
    apiClient.get(`/answers/${questionnaireId}`, { params }),
  
  /**
   * 获取统计结果
   * @param questionnaireId 问卷ID
   *
   * 注意：后端实际路径为 /api/answers/statistics/:questionnaireId
   * （静态段 statistics 必须置于参数路径前，详见 BUG-001）
   */
  getStatistics: (questionnaireId: string) =>
    apiClient.get(`/answers/statistics/${questionnaireId}`),

  /**
   * 获取仪表盘数据（V-008）
   *
   * 跨问卷全局统计，返回管理员首页仪表盘所需的概览与分布数据。
   * 后端路径：GET /api/answers/statistics/dashboard
   * 注意：路由顺序上 /statistics/dashboard 必须在 /statistics/:questionnaireId 之前
   */
  getDashboard: () =>
    apiClient.get('/answers/statistics/dashboard'),

  /**
   * 导出答案数据
   * @param questionnaireId 问卷ID
   * @param format 导出格式
   */
  export: (questionnaireId: string, format: 'csv' | 'excel' = 'csv') =>
    apiClient.get(`/answers/${questionnaireId}/export`, {
      params: { format },
      responseType: 'blob'  // 二进制响应（文件下载）
    }),
};

// ==================== 模板相关 API ====================

/**
 * 模板 API
 * 处理问卷模板的获取和使用
 */
export const templateApi = {
  /**
   * 获取模板列表
   * @param params 查询参数
   */
  getList: (params?: { category?: string }) =>
    apiClient.get('/templates', { params }),
  
  /**
   * 获取单个模板详情
   * @param id 模板ID
   */
  getById: (id: string) =>
    apiClient.get(`/templates/${id}`),
  
  /**
   * 基于模板创建问卷
   * @param id 模板ID
   * @param data 自定义数据
   */
  createQuestionnaire: (id: string, data?: { title?: string; description?: string }) =>
    apiClient.post(`/templates/${id}/create`, data || {}),
  
  /**
   * 初始化预设模板（管理员）
   */
  init: () =>
    apiClient.post('/templates/init'),
};

export default apiClient;