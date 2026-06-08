/**
 * Vite 配置文件
 * 
 * 功能说明：
 * - 配置 React 插件支持
 * - 配置开发服务器代理（解决跨域）
 * - 配置路径别名
 * 
 * Vite 特点：
 * - 基于 ES Modules 的快速开发服务器
 * - 使用 Rollup 进行生产构建
 * - 支持 TypeScript、JSX、CSS 等开箱即用
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    /**
     * React 插件
     * 提供以下功能：
     * - JSX/TSX 转换
     * - React Fast Refresh（热更新）
     * - 自动 JSX 运行时
     */
    react()
  ],
  
  /**
   * 路径别名配置
   * 简化模块导入路径
   * 例如：import { useAuthStore } from '@/store/authStore'
   */
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  
  /**
   * 开发服务器配置
   */
  server: {
    port: 5173,           // 开发服务器端口
    open: true,           // 自动打开浏览器
    
    /**
     * 代理配置
     * 将 /api 开头的请求转发到后端服务器
     * 解决开发环境的跨域问题
     */
    proxy: {
      '/api': {
        target: 'http://localhost:3000',  // 后端服务器地址
        changeOrigin: true,               // 改变请求源头
        // rewrite: (path) => path.replace(/^\/api/, '')  // 可选：重写路径
      }
    }
  },
  
  /**
   * 构建配置
   */
  build: {
    outDir: 'dist',       // 构建输出目录
    sourcemap: true       // 生成 source map（便于调试）
  }
});