/**
 * 认证状态管理（Zustand）
 * 
 * 功能说明：
 * - 管理用户登录状态
 * - 存储用户信息
 * - 提供登录/登出方法
 * 
 * Zustand 特点：
 * - 轻量级状态管理库
 * - 无需 Provider 包裹
 * - 支持 TypeScript
 * - 支持持久化（通过中间件）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 用户信息接口
 */
interface User {
  id: string;           // 用户ID
  username: string;     // 用户名
  email: string;        // 邮箱
  role: 'admin' | 'user'; // 角色
}

/**
 * 认证状态接口
 */
interface AuthState {
  // 状态
  token: string | null;     // JWT 令牌
  user: User | null;        // 用户信息
  isAuthenticated: boolean; // 是否已认证
  
  // 方法
  login: (token: string, user: User) => void;  // 登录
  logout: () => void;                           // 登出
  updateUser: (user: Partial<User>) => void;    // 更新用户信息
}

/**
 * 创建认证状态存储
 * 
 * persist 中间件：
 * - 自动将状态持久化到 localStorage
 * - 页面刷新后状态不丢失
 * - 配置 name 作为存储键名
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // 初始状态
      token: null,
      user: null,
      isAuthenticated: false,
      
      /**
       * 登录方法
       * @param token JWT 令牌
       * @param user 用户信息
       */
      login: (token: string, user: User) => {
        // 同时更新状态和本地存储
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        set({
          token,
          user,
          isAuthenticated: true,
        });
      },
      
      /**
       * 登出方法
       * 清除所有认证信息
       */
      logout: () => {
        // 清除本地存储
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
        
        // 跳转到登录页
        window.location.href = '/login';
      },
      
      /**
       * 更新用户信息
       * @param user 部分用户信息
       */
      updateUser: (user: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...user } : null,
        }));
      },
    }),
    {
      // 持久化配置
      name: 'auth-storage',  // localStorage 键名
    }
  )
);

export default useAuthStore;