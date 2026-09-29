FROM node:24.14.1-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS dev
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @nexaerp/api dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter @nexaerp/shared build
RUN pnpm --filter @nexaerp/api build

FROM node:24.14.1-alpine AS runtime
RUN corepack enable
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/apps/api/package.json apps/api/package.json
COPY --from=build --chown=node:node /app/apps/web/package.json apps/web/package.json
COPY --from=build --chown=node:node /app/packages/shared/package.json packages/shared/package.json
USER node
RUN pnpm install --frozen-lockfile --prod --filter @nexaerp/api...
COPY --from=build --chown=node:node /app/apps/api/dist apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma apps/api/prisma
COPY --from=build --chown=node:node /app/packages/shared/dist packages/shared/dist
ENV NODE_ENV=production
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health/ready || exit 1
CMD ["node", "apps/api/dist/main.js"]
