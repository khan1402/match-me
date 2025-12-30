# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm install --frozen-lockfile
RUN pnpm rebuild esbuild

COPY . .
RUN pnpm run build

# Runtime stage
FROM node:22-alpine
WORKDIR /app
RUN npm i -g serve

COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist/public", "-l", "3000"]

