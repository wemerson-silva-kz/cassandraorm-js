# CassandraORM JS Development Container
FROM node:18-alpine

# Install Bun
RUN npm install -g bun

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose port for development server
EXPOSE 3000
EXPOSE 9042

# Development command
CMD ["bun", "run", "dev"]
