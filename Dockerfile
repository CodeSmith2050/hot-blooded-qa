# 前端构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package.json和package-lock.json
COPY frontend/package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源码
COPY frontend/ .

# 构建生产版本
RUN npm run build

# 生产阶段
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制自定义配置
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
