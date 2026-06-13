#!/bin/bash

# =====================================
# 无偿献血问卷系统 - 开发环境部署脚本
# =====================================

set -e

echo "=================================="
echo "  开发环境部署脚本"
echo "=================================="

# 进入项目根目录
cd "$(dirname "$0")/.."

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker 未运行，请启动 Docker Desktop"
    exit 1
fi

# 创建目录
echo "📁 创建必要目录..."
mkdir -p data/mongo ssl logs

# 设置环境变量（开发环境）
echo "📝 设置开发环境变量..."
if [ ! -f .env ]; then
    if [ -f .env.dev ]; then
        cp .env.dev .env
        echo "✅ 已复制 .env.dev 到 .env"
    else
        echo "⚠️ 未找到 .env.dev 文件，请手动创建 .env"
    fi
fi

# 停止现有容器
echo "🛑 停止现有服务..."
docker-compose down 2>/dev/null || true

# 构建并启动
echo "🚀 启动服务..."
docker-compose up -d --build

# 等待启动
echo "⏳ 等待服务启动..."
sleep 15

# 显示状态
echo "📊 服务状态:"
docker-compose ps

echo ""
echo "=================================="
echo "  ✅ 部署完成！"
echo "=================================="
echo ""
echo "访问地址："
echo "  前端: http://localhost/admin/list"
echo "  API:  http://localhost/api"
echo ""
echo "常用命令："
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
