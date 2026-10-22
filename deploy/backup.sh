#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
stamp=$(date -u +%Y-%m-%dT%H-%M-%SZ)
destination="backups/$stamp"
mkdir -p "$destination"
# Stop writers briefly so the database, sessions and cloud objects are one snapshot.
docker compose stop app
trap 'docker compose start app >/dev/null' EXIT
trap 'exit 1' HUP INT TERM
docker compose run --rm --no-deps -T app tar -C /app/data -czf - . > "$destination/server-data.tar.gz"
cp .env "$destination/.env"
chmod 600 "$destination/.env" "$destination/server-data.tar.gz"
docker compose start app
trap - EXIT HUP INT TERM
printf '%s\n' "已备份账户、数据库、云备份文件与配置：$destination；浏览器本地照片仍需各自导出。"
