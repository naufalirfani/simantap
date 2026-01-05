# Multi-stage Dockerfile for building a Vite React app and serving with nginx
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Use custom nginx config with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
