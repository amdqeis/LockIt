FROM node:22-alpine
WORKDIR /app

# Install curl for healthcheck, openssl for Prisma, and postgresql16-client for backup/restore
RUN apk add --no-cache curl openssl postgresql16-client

# Install all deps (termasuk devDependencies — perlu tsx & prisma CLI)
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma client before copying rest of source for better layer caching
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY . .

RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    JWT_ACCESS_SECRET="build-only-access-secret" \
    JWT_REFRESH_SECRET="build-only-refresh-secret" \
    STUDENT_SESSION_SECRET="build-only-student-secret" npm run build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
