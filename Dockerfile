# ---------------------------------------------------------------------------
# 1. Aşama: arayüzü derle (Vite + TypeScript devDependencies gerekir)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# ---------------------------------------------------------------------------
# 2. Aşama: yalnızca çalıştırma (sunucu sadece Node yerleşik modüllerini kullanır,
# bu yüzden node_modules gerekmez)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    NOTIFY_HOST=0.0.0.0

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY server ./server

RUN mkdir -p /app/.data

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
