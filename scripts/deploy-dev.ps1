# =====================================
# 无偿献血问卷系统 - 开发环境部署脚本 (Windows)
# =====================================

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  开发环境部署脚本" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# 检查Docker
Write-Host "`n📋 检查Docker..." -ForegroundColor Green
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker 未安装" -ForegroundColor Red
    exit 1
}

try {
    docker info 2>&1 | Out-Null
} catch {
    Write-Host "❌ Docker 未运行，请启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 创建目录
Write-Host "`n📁 创建必要目录..." -ForegroundColor Green
New-Item -ItemType Directory -Path "data\mongo" -Force | Out-Null
New-Item -ItemType Directory -Path "ssl" -Force | Out-Null
New-Item -ItemType Directory -Path "logs" -Force | Out-Null

# 设置环境变量
Write-Host "`n📝 设置开发环境变量..." -ForegroundColor Green
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.dev") {
        Copy-Item ".env.dev" ".env"
        Write-Host "✅ 已复制 .env.dev 到 .env" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 未找到 .env.dev 文件" -ForegroundColor Yellow
    }
}

# 停止现有容器
Write-Host "`n🛑 停止现有服务..." -ForegroundColor Green
docker-compose down 2>$null

# 构建并启动
Write-Host "`n🚀 启动服务..." -ForegroundColor Green
docker-compose up -d --build

# 等待启动
Write-Host "`n⏳ 等待服务启动..." -ForegroundColor Green
Start-Sleep -Seconds 15

# 显示状态
Write-Host "`n📊 服务状态:" -ForegroundColor Green
docker-compose ps

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "  ✅ 部署完成！" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址：" -ForegroundColor White
Write-Host "  前端: http://localhost/admin/list" -ForegroundColor Green
Write-Host "  API:  http://localhost/api" -ForegroundColor Green
Write-Host ""
Write-Host "常用命令：" -ForegroundColor White
Write-Host "  查看日志: docker-compose logs -f" -ForegroundColor Yellow
Write-Host "  停止服务: docker-compose down" -ForegroundColor Yellow
Write-Host "  重启服务: docker-compose restart" -ForegroundColor Yellow
