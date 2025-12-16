# Build Stage for React Client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
RUN npm run build

# Production Stage for Node Server
FROM node:20-alpine
WORKDIR /app

# Install tzdata for timezone support
RUN apk add --no-cache tzdata

# Setup Server
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy Server Code
COPY server/ ./server/

# Copy Built Client from previous stage
COPY --from=client-builder /app/client/dist ./client/dist

# Expose Port
ARG PORT=5000
ENV PORT=$PORT
EXPOSE $PORT

# Start Server
WORKDIR /app/server
CMD ["node", "index.js"]
