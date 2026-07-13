# ── Build ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter @sales4u/web... --filter @sales4u/db

COPY apps/web ./apps/web

# Prisma client + build dos pacotes + Next standalone
RUN pnpm --filter @sales4u/db generate \
  && pnpm --filter @sales4u/core build \
  && pnpm --filter @sales4u/db build \
  && pnpm --filter "@sales4u/web^..." build \
  && cd apps/web && BUILD_STANDALONE=1 pnpm build

# ── Runtime ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
# Prisma engine + schema para `migrate deploy` no entrypoint
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

COPY infra/docker/web-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown -R app:app /app

USER app
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
