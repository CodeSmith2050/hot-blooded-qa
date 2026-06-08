/**
 * 应用根组件
 * 
 * 功能说明：
 * - 配置 React Router 路由
 * - 定义应用的整体布局
 * - 管理全局状态（如认证状态）
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';

// 页面组件
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import QuestionnaireListPage from './pages/Admin/QuestionnaireListPage';
import QuestionnaireCreatePage from './pages/Admin/QuestionnaireCreatePage';
import QuestionnaireEditPage from './pages/Admin/QuestionnaireEditPage';
import QuestionnaireFillPage from './pages/Public/QuestionnaireFillPage';
import StatisticsPage from './pages/Admin/StatisticsPage';

// 布局组件
import AdminLayout from './components/Layout/AdminLayout';
import PublicLayout from './components/Layout/PublicLayout';

// 认证守卫
import AuthGuard from './components/Auth/AuthGuard';

const { Content } = Layout;

/**
 * 应用主组件
 * 
 * 路由结构：
 * - /login          登录页
 * - /register       注册页
 * - /admin/*        管理后台（需要认证）
 *   - /admin/list     问卷列表
 *   - /admin/create   创建问卷
 *   - /admin/edit/:id 编辑问卷
 *   - /admin/stats/:id 统计数据
 * - /fill/:id       填写问卷（公开访问）
 * - /               首页重定向到问卷列表
 */
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 认证相关路由 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* 管理后台路由（需要认证） */}
        <Route
          path="/admin/*"
          element={
            <AuthGuard>
              <AdminLayout>
                <Routes>
                  <Route path="list" element={<QuestionnaireListPage />} />
                  <Route path="create" element={<QuestionnaireCreatePage />} />
                  <Route path="edit/:id" element={<QuestionnaireEditPage />} />
                  <Route path="stats/:id" element={<StatisticsPage />} />
                  <Route path="" element={<Navigate to="list" replace />} />
                </Routes>
              </AdminLayout>
            </AuthGuard>
          }
        />
        
        {/* 公开路由 - 填写问卷 */}
        <Route
          path="/fill/:id"
          element={
            <PublicLayout>
              <QuestionnaireFillPage />
            </PublicLayout>
          }
        />
        
        {/* 默认重定向 */}
        <Route path="/" element={<Navigate to="/admin/list" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;