FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-api-proxy.conf /etc/nginx/vortexbird-api-proxy.conf
COPY docker-entrypoint.sh /entrypoint.sh
USER 101
EXPOSE 8080
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
