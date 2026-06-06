# Build the registry website SPA and serve with nginx (API proxied at /api).
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY website/package.json ./
RUN npm install

COPY website/ ./

# Same-origin API calls — nginx proxies /api to the api service.
ARG VITE_DESKTOP_DOWNLOAD_URL=
ENV VITE_API_BASE_URL=
ENV VITE_DESKTOP_DOWNLOAD_URL=$VITE_DESKTOP_DOWNLOAD_URL
RUN npm run build

FROM nginx:1.27-alpine

COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
