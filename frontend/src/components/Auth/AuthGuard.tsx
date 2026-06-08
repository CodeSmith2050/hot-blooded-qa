/**
 * 认证守卫组件
 * 
 * 功能说明：
 * - 检查用户是否已登录
 * - 未登录则重定向到登录页
 * - 已登录则渲染子组件
 * 
 * 使用方式：
 * <AuthGuard>
 *   <AdminLayout>...</AdminLayout>
 * </AuthGuard>
 */

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 认证守卫
 * @param children 受保护的子组件
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  
  /**
   * 检查认证状态
   * 模拟短暂的加载状态，避免闪烁
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  // 检查中显示加载状态
  if (isChecking) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }
  
  // 未认证，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // 已认证，渲染子组件
  return <>{children}</>;
};

export default AuthGuard;