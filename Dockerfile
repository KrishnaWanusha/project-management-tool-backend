# Build stage
FROM node:18-alpine as builder

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy all necessary files for building
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

# Install ALL dependencies
RUN npm install

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Install tsconfig-paths
RUN npm install tsconfig-paths

# Create uploads directory and set permissions
RUN mkdir -p /app/uploads && \
    chown -R node:node /app && \
    chmod -R 755 /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 4000

# Set NODE_ENV
ENV NODE_ENV=production

# Create a volume for uploads
VOLUME ["/app/uploads"]

# Start the application
CMD ["npm", "start"]