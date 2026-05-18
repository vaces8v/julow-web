# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
#  Julow Web — production Dockerfile (multi-stage)
# ─────────────────────────────────────────────────────────────────────────────
#  Stage 1 (deps)    — устанавливает npm-зависимости в чистый слой,
#                      кэшируется на основе package-lock.json.
#  Stage 2 (builder) — собирает Next.js приложение в standalone-режиме
#                      (см. next.config.ts: output: 'standalone').
#                      На этом этапе нужны NEXT_PUBLIC_* переменные —
#                      они инлайнятся в client bundle на build time.
#  Stage 3 (runner)  — минимальный runtime-образ (~150MB). Запускает
#                      server.js из standalone-сборки под non-root пользователем.
#
#  Запуск (отдельно от docker-compose):
#    docker build -t julow-web .
#    docker run -p 3000:3000 \
#      --env NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 \
#      --env NEXT_PUBLIC_WS_BASE_URL=wss://api.example.com \
#      julow-web
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22-alpine

# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Alpine не даёт sharp работать без libc shim — подключаем libc6-compat.
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./

# `npm ci` строго следует lock-файлу и быстрее `npm install` в CI.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ── Stage 2: builder ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# NEXT_PUBLIC_* переменные должны быть доступны на build-time,
# потому что Next.js инлайнит их в JS-бандл клиента.
# Передавайте через `--build-arg` или ARG/env в docker-compose:
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_BASE_URL
ARG NEXT_PUBLIC_AGENTATION_ENDPOINT
ARG NEXT_PUBLIC_LANDING_HERO_VIDEO

ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_WS_BASE_URL=${NEXT_PUBLIC_WS_BASE_URL}
ENV NEXT_PUBLIC_AGENTATION_ENDPOINT=${NEXT_PUBLIC_AGENTATION_ENDPOINT}
ENV NEXT_PUBLIC_LANDING_HERO_VIDEO=${NEXT_PUBLIC_LANDING_HERO_VIDEO}

# Отключаем telemetry — экономит трафик и время сборки.
ENV NEXT_TELEMETRY_DISABLED=1
# Production режим — Next.js минимизирует CSS/JS, включает оптимизации.
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build с output: 'standalone' создаст:
#   /app/.next/standalone/  — минимальный server bundle
#   /app/.next/static/      — статические ассеты
#   /app/public/            — пользовательские ассеты
RUN npm run build

# ── Stage 3: runner ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Создаём non-root пользователя — best-practice для prod-контейнеров.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Копируем только то, что нужно для runtime:
#  - public/  — статические файлы
#  - .next/standalone/  — server.js + минимальные node_modules
#  - .next/static/  — JS/CSS бандлы клиента
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Healthcheck — Next.js standalone server отвечает 200 на корень.
# docker-compose использует это для определения готовности сервиса.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

# server.js — entry-point standalone-сборки, читает PORT/HOSTNAME из env.
CMD ["node", "server.js"]
