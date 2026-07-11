#!/bin/sh
# Roda migrations antes de subir o web (idempotente).
set -e

echo "[entrypoint] aplicando migrations…"
npx --yes prisma@6 migrate deploy --schema packages/db/prisma/schema.prisma

echo "[entrypoint] iniciando web…"
exec "$@"
