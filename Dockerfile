# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Install python3 and pip in builder stage (if needed for build)
RUN apk add --no-cache python3 py3-pip

COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm install

RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install python3 and pip in production stage
RUN apk add --no-cache python3 py3-pip

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

RUN npm install tsconfig-paths

RUN mkdir -p /app/uploads && \
    chown -R node:node /app && \
    chmod -R 755 /app

USER node

EXPOSE 4000

ENV NODE_ENV=production

VOLUME ["/app/uploads"]

CMD ["npm", "start"]
