#!/bin/bash
# 一键部署脚本 — 构建 + 打包 + 上传到阿里云
# 用法: bash deploy/deploy.sh

set -e

SERVER_IP="106.14.22.212"
SERVER_USER="root"
APP_DIR="/opt/my-blog"
DIST_DIR="dist"

echo "========================================="
echo "  TianCai的博客 — 部署到阿里云"
echo "========================================="

# 1. 构建
echo ""
echo "[1/5] 构建项目..."
npm run build

# 2. 打包
echo ""
echo "[2/5] 打包部署文件..."
tar -czf deploy.tar.gz \
  dist/ \
  package.json \
  package-lock.json \
  public/ \
  --exclude="node_modules" \
  --exclude="public/admin/index.html"  # Tina 生成的文件

# 3. 上传
echo ""
echo "[3/5] 上传到服务器 ${SERVER_IP}..."
scp deploy.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/

# 4. 服务器端部署
echo ""
echo "[4/5] 在服务器上安装部署..."
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
  set -e

  # 创建目录
  mkdir -p /opt/my-blog /var/log/my-blog /opt/my-blog/public/uploads

  # 解压
  cd /opt/my-blog
  tar -xzf /tmp/deploy.tar.gz
  rm /tmp/deploy.tar.gz

  # 安装依赖（仅生产依赖）
  npm ci --production 2>/dev/null || npm install --omit=dev

  # 创建上传目录
  mkdir -p public/uploads

  # 重启服务
  if command -v pm2 &> /dev/null; then
    pm2 reload ecosystem.config.cjs 2>/dev/null || pm2 start ecosystem.config.cjs
    pm2 save
  else
    echo "⚠️  PM2 未安装，请运行: npm install -g pm2"
    echo "   然后执行: pm2 start ecosystem.config.cjs && pm2 save"
  fi

  echo ""
  echo "✅ 部署完成！"
ENDSSH

# 5. 清理
echo ""
echo "[5/5] 清理本地临时文件..."
rm deploy.tar.gz

echo ""
echo "========================================="
echo "  部署成功！"
echo "  访问: http://${SERVER_IP}"
echo "========================================="
