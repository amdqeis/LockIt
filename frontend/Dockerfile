FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 INTERNAL_BACKEND_URL=http://backend:3000
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 INTERNAL_BACKEND_URL=http://backend:3000
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
