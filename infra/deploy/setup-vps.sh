#!/usr/bin/env bash
# Setup idempotente de VPS Ubuntu 22.04/24.04 para o VendaFlow.
# Uso: bash setup-vps.sh  (como root ou usuário com sudo)
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/iannini25/Maquina-de-vendas.git}"
APP_DIR="${APP_DIR:-/opt/vendaflow}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

log() { echo -e "\033[1;35m[setup]\033[0m $*"; }

# ── 1. Sistema ────────────────────────────────────────────────────────────
log "Atualizando o sistema…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw openssl

# ── 2. Swap se RAM < 4GB ─────────────────────────────────────────────────
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM_MB" -lt 4096 ] && [ ! -f /swapfile ]; then
  log "RAM ${TOTAL_RAM_MB}MB < 4GB — criando swap de 2GB…"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 3. Docker ─────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Instalando Docker…"
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# ── 4. Usuário deploy ─────────────────────────────────────────────────────
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  log "Criando usuário $DEPLOY_USER…"
  useradd -m -s /bin/bash "$DEPLOY_USER"
  usermod -aG docker "$DEPLOY_USER"
fi

# ── 5. Firewall ───────────────────────────────────────────────────────────
log "Configurando UFW (22/80/443)…"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── 6. Código ─────────────────────────────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  log "Clonando repositório…"
  git clone "$REPO_URL" "$APP_DIR"
else
  log "Repositório existe — atualizando…"
  git -C "$APP_DIR" pull
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

# ── 7. .env ───────────────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log "Gerando .env — responda as perguntas:"
  read -rp "Domínio do app (ex: app.seudominio.com): " APP_DOMAIN
  read -rp "Domínio das landings (ex: seudominio.com): " LANDING_DOMAIN
  read -rp "Domínio da Evolution (opcional, Enter para pular): " EVOLUTION_DOMAIN

  AUTH_SECRET=$(openssl rand -base64 32)
  APP_ENCRYPTION_KEY=$(openssl rand -base64 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 24)
  EVOLUTION_GLOBAL_KEY=$(openssl rand -hex 24)
  S3_SECRET=$(openssl rand -hex 24)

  cat > "$ENV_FILE" <<ENV
APP_URL=https://${APP_DOMAIN}
LANDING_URL=https://${LANDING_DOMAIN}
APP_DOMAIN=${APP_DOMAIN}
LANDING_DOMAIN=${LANDING_DOMAIN}
EVOLUTION_DOMAIN=${EVOLUTION_DOMAIN}
AUTH_SECRET=${AUTH_SECRET}
APP_ENCRYPTION_KEY=${APP_ENCRYPTION_KEY}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://vendaflow:${POSTGRES_PASSWORD}@postgres:5432/vendaflow
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=vendaflow
S3_SECRET_KEY=${S3_SECRET}
S3_BUCKET=vendaflow
S3_REGION=us-east-1
AI_MODEL_CHAT=claude-sonnet-4-6
AI_MODEL_CLASSIFIER=claude-haiku-4-5-20251001
AI_MODEL_HEAVY=claude-opus-4-8
EMBEDDINGS_MODEL=voyage-3
EVOLUTION_URL=http://evolution:8080
EVOLUTION_GLOBAL_KEY=${EVOLUTION_GLOBAL_KEY}
SEED_DEMO=false
NODE_ENV=production
ENV
  chmod 600 "$ENV_FILE"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
  log ".env criado em $ENV_FILE"
else
  log ".env já existe — mantendo."
fi

# ── 8. Subir os serviços ──────────────────────────────────────────────────
log "Subindo docker compose…"
cd "$APP_DIR"
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d --build

# ── 9. Backup diário ──────────────────────────────────────────────────────
log "Agendando backup diário (03:30)…"
mkdir -p /backup
chmod +x "$APP_DIR/infra/deploy/backup.sh"
CRON_LINE="30 3 * * * APP_DIR=$APP_DIR /bin/bash $APP_DIR/infra/deploy/backup.sh >> /var/log/vendaflow-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v backup.sh; echo "$CRON_LINE" ) | crontab -

log "Pronto! Verifique:"
log "  docker compose -f infra/docker-compose.prod.yml ps"
log "  https://\$APP_DOMAIN (após o DNS propagar; TLS é automático)"
