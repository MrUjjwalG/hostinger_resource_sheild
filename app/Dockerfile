# Build Stage for React Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
ARG BASE_PATH
ENV VITE_BASE_PATH=$BASE_PATH
RUN npm run build

# Production Stage for Node Server
FROM node:20-alpine

# Install tzdata for timezone support and dumb-init for signal handling
RUN apk add --no-cache tzdata dumb-init

WORKDIR /app

# Setup Server dependencies
COPY --chown=node:node server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy Server Code with ownership
COPY --chown=node:node server/ ./server/

# Copy Built Client from previous stage with ownership
COPY --chown=node:node --from=client-builder /app/client/dist ./client/dist

# Expose Port
ARG PORT=5000
ENV PORT=$PORT
EXPOSE $PORT

# Switch to non-root user for security
USER node

# Start Server
WORKDIR /app/server
# Use dumb-init to handle signals properly (PID 1)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]
