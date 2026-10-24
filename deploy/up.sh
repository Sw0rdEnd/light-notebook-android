#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  umask 077
  cp .env.example .env
  printf '%s\n' '已创建.env；请按SERVER_DEPLOYMENT.md填写域名，AI可保持关闭，然后再次运行。'
  exit 2
fi
chmod 600 .env
docker compose version >/dev/null
docker compose config --quiet
app_image=$(docker compose config --images | sed -n '/^light-notebook:/p' | head -n 1)
if [ -n "$app_image" ] && docker image inspect "$app_image" >/dev/null 2>&1; then
  previous_schema=$(docker image inspect --format '{{index .Config.Labels "org.light-notebook.server-schema"}}' "$app_image")
  if [ "$previous_schema" = "1" ]; then
    docker image tag "$app_image" light-notebook:rollback
  else
    printf '%s\n' '旧镜像未标注后台数据库兼容性，不将其设为回滚目标。请先保留完整数据卷备份。'
  fi
fi
docker compose build --pull
docker compose run --rm --no-deps app node server/preflight.mjs
docker compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose up -d --wait --wait-timeout 90
docker compose exec -T app node server/smoke.mjs
docker compose exec -T app node -e 'console.log("容器内检查已通过。请在浏览器验证公网HTTPS："+process.env.PUBLIC_ORIGIN)'
