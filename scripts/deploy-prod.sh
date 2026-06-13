#!/bin/bash

# =====================================
# 无偿献血问卷系统 - 生产环境部署脚本
# =====================================

set -e

echo "=================================="
echo "  生产环境部署脚本"
echo "=================================="

# 进入项目根目录
cd "$(dirname "$0")/.."

# 检查是否在生产环境
read -p "⚠️ 确认在生产环境部署？(y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "已取消部署"
    exit 0
fi

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker 未运行"
    exit 1
fi

# 检查SSL证书
if [ ! -f "ssl/fullchain.pem" ] || [ ! -f "ssl/privkey.pem" ]; then
    echo "⚠️ SSL证书未配置，请将证书放入 ssl/ 目录"
    echo "   需要: ssl/fullchain.pem 和 ssl/privkey.pem"
    read -p "是否继续？(y/N): " continue
    if [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
        exit 0
    fi
fi

# 创建目录
echo "📁 创建必要目录..."
mkdir -p data/mongo logs

# 设置环境变量（生产环境）
echo "📝 设置生产环境变量..."
if [ ! -f .env ]; then
    if [ -f .env.prod ]; then
        cp .env.prod .env
        echo "✅ 已复制 .env.prod 到 .env"
    else
        echo "❌ 未找到 .env.prod 文件"
        exit 1
    fi
else
    echo "⚠️ .env 已存在，将使用现有配置"
fi

# 备份数据（如果存在）
if [ -d "data/mongo" ]; then
    echo "📦 备份数据..."
    backup_dir="backup/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    cp -r data/mongo "$backup_dir/"
    echo "✅ 备份已保存到 $backup_dir"
fi

# 停止现有容器
echo "🛑 停止现有服务..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# 拉取最新代码（如使用Git）
if command -v git &> /dev/null; then
    echo "📥 拉取最新代码..."
    git pull origin main 2>/dev/null || echo "⚠️ Git拉取失败，使用当前代码"
fi

# 构建并启动
echo "🚀 构建并启动服务..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 等待启动
echo "⏳ 等待服务启动..."
sleep 20

# 检查健康状态
echo "🏥 检查服务健康状态..."
for i in {1..5}; do
    if curl -s http://localhost/health > /dev/null 2>&1; then
        echo "✅ 服务健康检查通过"
        break
    fi
    echo "⏳ 等待服务就绪... ($i/5)"
    sleep 5
done

# 显示状态
echo "📊 服务状态:"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo ""
echo "=================================="
echo "  ✅ 生产环境部署完成！"
echo "=================================="
echo ""
echo "访问地址："
echo "  前端: https://survey.yourdomain.com"
echo "  API:  https://survey.yourdomain.com/api"
echo "  健康:  http://localhost/health"
echo ""
echo "常用命令："
echo "  查看日志: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo "  停止服务: docker-compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo "  重启服务: docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart"
