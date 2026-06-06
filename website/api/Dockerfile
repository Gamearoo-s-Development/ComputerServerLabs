# Registry API — SQLite database lives on the compose `registry-db` volume.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY website/api/package.json website/api/package-lock.json* ./
RUN npm ci --omit=dev

COPY website/api/ ./

# Bundled labs for first-time seed (REPO_ROOT=/repo/app → /repo/app/labs/<id>).
COPY app/labs /repo/app/labs

# seed.js imports ../../../../shared/lab-format from /app/src/db → /shared/lab-format
COPY shared/lab-format /shared/lab-format

# Registry-only labs (not in app/labs / desktop installer).
COPY website/catalog-labs /repo/catalog-labs

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATABASE_PATH=/data/registry.db \
    LAB_PACKS_DIR=/data/lab-packs \
    REPO_ROOT=/repo/app \
    CATALOG_LABS_DIR=/repo/catalog-labs

RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 8787

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["sh", "docker-entrypoint.sh"]
