#!/bin/bash
# 阿里云服务器初始配置脚本（首次部署时运行一次）
# 用法: ssh root@106.14.22.212 'bash -s' < deploy/setup-server.sh

set -e

echo "========================================="
echo "  初始化阿里云服务器"
echo "========================================="

# 1. 安装 Node.js 22
echo ""
echo "[1/6] 安装 Node.js 22..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "Node.js $(node -v)"

# 2. 安装 Nginx
echo ""
echo "[2/6] 安装 Nginx..."
apt-get update
apt-get install -y nginx

# 3. 安装 PM2
echo ""
echo "[3/6] 安装 PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root

# 4. 创建目录
echo ""
echo "[4/6] 创建应用目录..."
mkdir -p /opt/my-blog /var/log/my-blog /opt/my-blog/public/uploads

# 5. 配置 Nginx
echo ""
echo "[5/6] 配置 Nginx..."
cat > /etc/nginx/conf.d/my-blog.conf << 'NGINX'
server {
    listen 80;
    server_name 106.14.22.212;

    client_max_body_size 10M;

    access_log /var/log/nginx/my-blog-access.log;
    error_log  /var/log/nginx/my-blog-error.log;

    location /_astro/ {
        alias /opt/my-blog/dist/client/_astro/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        alias /opt/my-blog/public/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }

    location = /favicon.svg {
        alias /opt/my-blog/dist/client/favicon.svg;
        expires 1d;
    }

    location = /robots.txt {
        alias /opt/my-blog/dist/client/robots.txt;
        expires 1d;
    }

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINX

# 测试 Nginx 配置
nginx -t

# 6. 配置防火墙（阿里云安全组同样需要放行 80）
echo ""
echo "[6/6] 开放防火墙端口..."
if command -v ufw &> /dev/null; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

# 启动 Nginx
systemctl enable nginx
systemctl restart nginx

echo ""
echo "========================================="
echo "  ✅ 服务器初始化完成！"
echo "  下一步: 运行 deploy/deploy.sh 部署代码"
echo "========================================="
