FROM node:22-alpine
WORKDIR /app

# Install curl for healthcheck & openssl for Prisma query engine
RUN apk add --no-cache curl openssl

# Install all deps (termasuk devDependencies — perlu tsx & prisma CLI)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    JWT_ACCESS_SECRET="build-only-access-secret" \
    JWT_REFRESH_SECRET="build-only-refresh-secret" \
    STUDENT_SESSION_SECRET="build-only-student-secret" npm run build

ENV NODE_ENV=production PORT=3000
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
