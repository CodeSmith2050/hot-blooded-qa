/**
 * 前端应用入口文件
 * 
 * 功能说明：
 * - 创建 React 根节点
 * - 渲染应用组件
 * - 配置 StrictMode（开发模式下的额外检查）
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';

// 导入全局样式
import './styles/global.css';

/**
 * 创建 React 根节点
 * React 18 新特性：createRoot 支持并发渲染
 */
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

/**
 * 渲染应用
 * 
 * ConfigProvider：Ant Design 全局配置
 * - locale: 设置中文语言包
 * - theme: 可配置主题色等
 */
root.render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);