# syntax=docker/dockerfile:1
# Northflank deployment — Nuxt 4 / Nitro SSR (node-server preset).
# Nitro auto-detects no provider here, so it builds the default Node
# server into .output/. Runtime = `node .output/server/index.mjs`.

# ---- Build stage -----------------------------------------------------
FROM node:22-alpine AS build
# corepack reads "packageManager" from package.json (pnpm@10.22.0)
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---- Runtime stage ---------------------------------------------------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
# Northflank injects PORT; Nitro reads it. 3000 is the local fallback.
ENV PORT=3000
EXPOSE 3000
# Only the self-contained Nitro output ships — no node_modules needed.
COPY --from=build /app/.output ./.output
CMD ["node", ".output/server/index.mjs"]
