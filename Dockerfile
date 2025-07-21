# 1) Стадия сборки зависимостей
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 2) Стадия копирования кода и сборки (если нужно)
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
# Если у вас есть сборка (TS, Webpack и т.п.) — здесь её вызвать:
# RUN npm run build

# 3) Стадия продакшена
FROM node:18-alpine AS prod
WORKDIR /app
COPY --from=builder /app ./
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "app.js"]
