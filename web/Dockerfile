# Build the SPA (pnpm; lockfile is v9).
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Serve the built assets + reverse-proxy the API on one origin (mirrors the dev
# Vite proxy). nginx listens on 8090, the host-bound, tunnel-facing port.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8090/ >/dev/null 2>&1 || exit 1
