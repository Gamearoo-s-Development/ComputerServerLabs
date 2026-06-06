# Computer Server Labs Lab Registry Website

Browse labs, sign in, link the desktop app via device code, and view leaderboards on the public registry website.

This folder is the **website only**. The Electron desktop app lives in `../app/`.

## Docker (recommended for self-hosting)

Runs the website (nginx), registry API, and MariaDB — all isolated from your host.

```bash
cd website
cp .env.docker.example .env.docker
# Edit .env.docker — set JWT_SECRET at minimum
docker compose up --build
```

Open **http://localhost:8080** locally. Production: **https://computerserverlabs.com** (site and `/api` on the same origin).

## Local development (monorepo)

From the **repository root**:

```bash
npm install
npm run dev:api      # API on http://127.0.0.1:8787
npm run dev:website  # SPA on http://127.0.0.1:5174
```

Configure the API first:

```bash
cd website/api
cp .env.example .env
npm run seed
```

The website dev server proxies `/api` to port 8787 (see `vite.config.js`).

## Layout

| Path | Purpose |
|------|---------|
| `src/` | React SPA (home, lab catalog, publish, account, link device) |
| `api/` | Fastify registry API (auth, labs, sync, leaderboards) |
| `catalog-labs/` | Official labs on the registry only (not in `app/labs` / desktop installer) |

## Homepage download link

Set your GitHub Releases URL so the **Download desktop app** button works:

- **Docker:** `DESKTOP_DOWNLOAD_URL` in `.env.docker` (also passed into the SPA build)
- **Local API:** `DESKTOP_DOWNLOAD_URL` in `website/api/.env`
- **Local Vite:** `VITE_DESKTOP_DOWNLOAD_URL` in `website/.env.local` (see `.env.example`)

## Publish community labs

Signed-in users with a verified email can upload a lab pack ZIP at **Publish** (`POST /api/labs/publish`). Packs are stored without cryptographic signing; the catalog offers direct ZIP downloads.

## Device linking flow

1. Desktop app: **Account → Link Account**
2. Browser opens `/link-device` on your hosted website
3. Sign in and enter the 8-character code
4. Desktop app receives tokens (no website password stored locally)

Point the desktop app’s **Settings → Online registry** at your deployed website URL (same origin as this SPA).
