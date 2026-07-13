#!/usr/bin/env bash
# Backup diário: pg_dump + volumes essenciais → /backup com retenção de 7 dias.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sales4u}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
STAMP=$(date +%Y%m%d-%H%M%S)
COMPOSE="docker compose -f $APP_DIR/infra/docker-compose.prod.yml --env-file $APP_DIR/.env"

mkdir -p "$BACKUP_DIR"

echo "[backup] $STAMP — pg_dump…"
$COMPOSE exec -T postgres pg_dumpall -U sales4u | gzip > "$BACKUP_DIR/pg-$STAMP.sql.gz"

echo "[backup] volumes (minio + evolution)…"
docker run --rm \
  -v sales4u_minio_data:/data/minio:ro \
  -v sales4u_evolution_instances:/data/evolution:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/volumes-$STAMP.tar.gz" -C /data .

echo "[backup] retenção 7 dias…"
find "$BACKUP_DIR" -name "pg-*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "volumes-*.tar.gz" -mtime +7 -delete

echo "[backup] ok — $(ls -lh "$BACKUP_DIR" | tail -3)"
