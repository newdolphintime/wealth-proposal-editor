#!/usr/bin/env bash
# 财富规划建议书编辑器 —— 服务器一键部署脚本（在服务器上以 root 执行）
# 用法：bash install.sh [端口]，默认 6000
set -euo pipefail

PORT="${1:-6000}"
APP_DIR=/var/www/wealth-proposal-editor
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/wealth-proposal-editor"

echo ">>> 安装 nginx（如已安装会跳过）"
if ! command -v nginx >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  else
    yum install -y epel-release || true
    yum install -y nginx
  fi
fi

echo ">>> 复制静态文件到 $APP_DIR"
mkdir -p "$APP_DIR"
rm -rf "${APP_DIR:?}"/*
cp -r "$SRC_DIR"/* "$APP_DIR"/

echo ">>> 写入 nginx 配置（端口 $PORT）"
CONF_DIR=/etc/nginx/conf.d
mkdir -p "$CONF_DIR"
cat > "$CONF_DIR/wealth-proposal-editor.conf" <<EOF
server {
    listen ${PORT};
    server_name _;
    root ${APP_DIR};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
EOF

# SELinux（CentOS/RHEL）需要放行非标准端口
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" = "Enforcing" ]; then
  echo ">>> SELinux 放行端口 $PORT"
  command -v semanage >/dev/null 2>&1 || yum install -y policycoreutils-python-utils || yum install -y policycoreutils-python
  semanage port -a -t http_port_t -p tcp "$PORT" 2>/dev/null || semanage port -m -t http_port_t -p tcp "$PORT"
  chcon -R -t httpd_sys_content_t "$APP_DIR" || true
fi

echo ">>> 放行系统防火墙端口 $PORT"
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${PORT}/tcp" && firewall-cmd --reload
elif command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${PORT}/tcp"
fi

echo ">>> 检查并重载 nginx"
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx

if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null; then
  echo ">>> 部署成功：http://<服务器公网IP>:${PORT}/"
  echo ">>> 注意：还需要在云服务器控制台的“安全组”中放行 TCP ${PORT} 入站。"
else
  echo "!!! 本机访问 127.0.0.1:${PORT} 失败，请检查：systemctl status nginx" >&2
  exit 1
fi
