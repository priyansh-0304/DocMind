FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Script to inject backend URL at runtime
RUN echo '#!/bin/sh' > /docker-entrypoint.d/inject-env.sh && \
    echo 'sed -i "s|BACKEND_URL_PLACEHOLDER|$API_URL|g" /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.d/inject-env.sh && \
    chmod +x /docker-entrypoint.d/inject-env.sh

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]