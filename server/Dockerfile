## Dockerfile for the socket/express server
FROM node:20-alpine
WORKDIR /srv
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
EXPOSE 4001
CMD [ "node", "index.js" ]
