# =====================================
# 无偿献血问卷系统 - 生产环境部署脚本 (Windows)
# =====================================

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  生产环境部署脚本" -ForegroundColor Red
Write-Host "==================================" -ForegroundColor Cyan

# 确认生产部署
Write-Host "`n⚠️ 警告：此脚本用于生产环境部署" -ForegroundColor Red
$confirm = Read-Host "确认在生产环境部署？(y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "已取消部署" -ForegroundColor Yellow
    exit 0
}

# 检查Docker
Write-Host "`n📋 检查Docker..." -ForegroundColor Green
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker 未安装" -ForegroundColor Red
    exit 1
}

try {
    docker info 2>&1 | Out-Null
} catch {
    Write-Host "❌ Docker 未运行" -ForegroundColor Red
    exit 1
}

# 检查SSL证书
Write-Host "`n📋 检查SSL证书..." -ForegroundColor Green
if (-not (Test-Path "ssl\fullchain.pem") -or -not (Test-Path "ssl\privkey.pem")) {
    Write-Host "⚠️ SSL证书未配置" -ForegroundColor Yellow
    Write-Host "   需要: ssl\fullchain.pem 和 ssl\privkey.pem" -ForegroundColor Yellow
    $continue = Read-Host "是否继续？(y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 0
    }
}

# 创建目录
Write-Host "`n📁 创建必要目录..." -ForegroundColor Green
New-Item -ItemType Directory -Path "data\mongo" -Force | Out-Null
New-Item -ItemType Directory -Path "backup" -Force | Out-Null
New-Item -ItemType Directory -Path "logs" -Force | Out-Null

# 设置环境变量
Write-Host "`n📝 设置生产环境变量..." -ForegroundColor Green
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.prod") {
        Copy-Item ".env.prod" ".env"
        Write-Host "✅ 已复制 .env.prod 到 .env" -ForegroundColor Green
    } else {
        Write-Host "❌ 未找到 .env.prod 文件" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️ .env 已存在，将使用现有配置" -ForegroundColor Yellow
}

# 备份数据
if (Test-Path "data\mongo") {
    Write-Host "`n📦 备份数据..." -ForegroundColor Green
    $backupDir = "backup\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item -Recurse "data\mongo" "$backupDir\"
    Write-Host "✅ 备份已保存到 $backupDir" -ForegroundColor Green
}

# 停止现有容器
Write-Host "`n🛑 停止现有服务..." -ForegroundColor Green
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down 2>$null

# 构建并启动
Write-Host "`n🚀 构建并启动服务..." -ForegroundColor Green
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 等待启动
Write-Host "`n⏳ 等待服务启动..." -ForegroundColor Green
Start-Sleep -Seconds 20

# 检查健康状态
Write-Host "`n🏥 检查服务健康状态..." -ForegroundColor Green
$healthCheck = 0
for ($i = 1; $i -le 5; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ 服务健康检查通过" -ForegroundColor Green
            $healthCheck = 1
            break
        }
    } catch {}
    Write-Host "⏳ 等待服务就绪... ($i/5)" -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

# 显示状态
Write-Host "`n📊 服务状态:" -ForegroundColor Green
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "  ✅ 生产环境部署完成！" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址：" -ForegroundColor White
Write-Host "  前端: https://survey.yourdomain.com" -ForegroundColor Green
Write-Host "  API:  https://survey.yourdomain.com/api" -ForegroundColor Green
Write-Host "  健康:  http://localhost/health" -ForegroundColor Green
Write-Host ""
Write-Host "常用命令：" -ForegroundColor White
Write-Host "  查看日志: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f" -ForegroundColor Yellow
Write-Host "  停止服务: docker-compose -f docker-compose.yml -f docker-compose.prod.yml down" -ForegroundColor Yellow
