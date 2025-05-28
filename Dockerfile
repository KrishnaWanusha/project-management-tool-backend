# Build stage
FROM node:18 as builder

WORKDIR /app

# Copy project files
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY models/ ./models/
COPY ai_model/ ./ai_model/

# Install dependencies and build
RUN npm install
RUN npm run build

# Final stage with Python
FROM python:3.10-slim

# Install Node.js and npm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app files
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/models ./models
COPY --from=builder /app/ai_model ./ai_model

# Set up app folder
RUN mkdir -p /app/uploads && chmod -R 755 /app

EXPOSE 4000

ENV NODE_ENV=production

CMD ["npm", "start"]
