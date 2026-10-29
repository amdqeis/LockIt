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

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
