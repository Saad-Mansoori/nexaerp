FROM node:24.14.1-alpine AS dev
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
EXPOSE 3000
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @nexaerp/web dev"]
