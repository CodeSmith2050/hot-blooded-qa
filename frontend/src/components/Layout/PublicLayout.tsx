/**
 * 公开页面布局组件
 * 
 * 功能说明：
 * - 用于问卷填写等公开访问页面
 * - 简洁的头部和居中内容区
 * - 移动端友好
 * 
 * 布局结构：
 * ┌─────────────────────────────────────┐
 * │  Header（Logo + 标题）               │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │         Content（主内容）            │
 * │                                     │
 * └─────────────────────────────────────┘
 */

import React from 'react';
import { Layout } from 'antd';

const { Header, Content } = Layout;

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * 公开页面布局
 * @param children 子组件（页面内容）
 */
const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 顶部头部 */}
      <Header
        style={{
          background: '#fff',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <h1
          style={{
            color: '#1890ff',
            fontSize: 20,
            fontWeight: 'bold',
            margin: 0,
            lineHeight: '64px',
          }}
        >
          热血问答
        </h1>
      </Header>
      
      {/* 主内容区 */}
      <Content
        style={{
          maxWidth: 800,
          width: '100%',
          margin: '24px auto',
          padding: '0 16px',
        }}
      >
        {children}
      </Content>
    </Layout>
  );
};

export default PublicLayout;