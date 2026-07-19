/**
 * 管理后台布局组件
 * 
 * 功能说明：
 * - 提供管理后台的整体布局结构
 * - 包含侧边栏导航和顶部头部
 * - 响应式设计：移动端自动收起侧边栏
 * 
 * 布局结构：
 * ┌─────────────────────────────────────┐
 * │  Header（顶部头部）                  │
 * ├──────────┬──────────────────────────┤
 * │          │                          │
 * │ Sidebar  │    Content（主内容区）     │
 * │（侧边栏） │                          │
 * │          │                          │
 * └──────────┴──────────────────────────┘
 */

import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Badge } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  PlusOutlined,
  BarChartOutlined,
  DashboardOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const { Header, Sider, Content } = Layout;

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * 管理后台布局
 * @param children 子组件（页面内容）
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  
  // 侧边栏折叠状态
  const [collapsed, setCollapsed] = useState(false);
  
  /**
   * 侧边栏菜单项配置
   * key: 路由路径
   * icon: 菜单图标
   * label: 菜单文本
   */
  const menuItems = [
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/admin/list',
      icon: <FileTextOutlined />,
      label: '问卷列表',
    },
    {
      key: '/admin/create',
      icon: <PlusOutlined />,
      label: '创建问卷',
    },
    {
      key: '/admin/stats',
      icon: <BarChartOutlined />,
      label: '数据统计',
    },
  ];
  
  /**
   * 用户下拉菜单项
   */
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];
  
  /**
   * 处理菜单点击
   * @param key 菜单项的 key（路由路径）
   */
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };
  
  /**
   * 处理用户下拉菜单点击
   * @param key 菜单项 key
   */
  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
    } else if (key === 'profile') {
      // TODO: 跳转到个人信息页
    }
  };
  
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth={80}
        onBreakpoint={(broken) => setCollapsed(broken)}
        style={{
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        }}
      >
        {/* Logo 区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          {collapsed ? (
            <span style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
              热
            </span>
          ) : (
            <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
              热血问答
            </span>
          )}
        </div>
        
        {/* 导航菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      
      <Layout>
        {/* 顶部头部 */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {/* 左侧：折叠按钮 */}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />
          
          {/* 右侧：通知和用户 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* 通知图标 */}
            <Badge count={0}>
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>
            
            {/* 用户下拉菜单 */}
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
            >
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.username || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        
        {/* 主内容区 */}
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;