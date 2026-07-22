# ── Build stage ──
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src/
RUN npx prisma generate && npm run build

# ── Production stage ──
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/src/generated ./src/generated/

USER appuser

ENV NODE_ENV=production
ENV PROCESS_ROLE=all

CMD ["node", "dist/main.js"]
