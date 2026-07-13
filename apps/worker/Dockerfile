# syntax=docker/dockerfile:1
# Worker Sales4U — BullMQ 24/7.
# Build a partir da RAIZ do monorepo:
#   docker build -f apps/worker/Dockerfile -t sales4u-worker .

# ── Estágio 1: build ────────────────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo

# Manifests primeiro para aproveitar cache de camadas do install.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

# Instala apenas o worker e suas dependências de workspace.
RUN pnpm install --frozen-lockfile --filter @sales4u/worker...

# Compila as dependências de workspace e o worker (inclui prisma generate no @sales4u/db).
RUN pnpm --filter @sales4u/worker... run build

# Nota: sem `pnpm prune --prod` — falha com install filtrado de workspace e
# removeria o Prisma Client gerado em node_modules. Custo: imagem um pouco
# maior (devDeps), aceitável para self-host.

# ── Estágio 2: runtime ──────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo

# Copia o workspace já compilado e podado (symlinks do pnpm preservados).
COPY --from=build /repo /repo

USER node
EXPOSE 3001
CMD ["node", "apps/worker/dist/main.js"]
