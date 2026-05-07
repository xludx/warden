FROM oven/bun:1.2.1-alpine AS base
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY drizzle/ ./drizzle/
COPY src/ ./src/

EXPOSE 3210

CMD ["bun", "run", "src/index.ts"]
