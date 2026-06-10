## Dockerfile for building Next.js frontend (production)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
COPY yarn.lock .
COPY . .
RUN npm ci --production=false && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/ .
EXPOSE 3000
CMD [ "npm", "run", "start" ]
