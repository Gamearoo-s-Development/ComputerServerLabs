# Computer Server Labs Registry API

Self-hostable lab registry, account linking (device code flow), cloud progress sync, leaderboards, and server-side email notifications.

## Quick start

```bash
cd website/api
cp .env.example .env
npm install
npm run seed
npm run dev
```

API default: `http://127.0.0.1:8787`

## Docker (website stack)

To run the **website + API** in Docker (not the desktop app), see [website/README.md](../website/README.md) and `website/docker-compose.yml`.

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/labs` | Browse labs (filters: category, difficulty, runtime, badge, q) |
| GET | `/api/labs/:id` | Lab detail |
| GET | `/api/labs/:id/download` | Download lab pack (.zip) |
| GET | `/api/labs/:id/source` | List viewable text files in the pack |
| GET | `/api/labs/:id/source/file?path=` | Read a single pack file (text, max 512 KB) |
| GET | `/api/labs/:id/checksum` | SHA-256 checksum |
| GET | `/api/labs/:id/signature` | Verified signature metadata |
| POST | `/api/auth/device/start` | Start desktop device link |
| POST | `/api/auth/device/poll` | Poll for approval |
| POST | `/api/auth/device/approve` | Approve code (website, authenticated) |
| POST | `/api/progress/sync` | Sync progress (authenticated) |
| GET | `/api/leaderboards/global` | Global leaderboard |

## Email (Hostinger SMTP)

Set in `website/api/.env` (local) or `website/.env.docker` (Docker stack):

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM_VERIFY=verify@yourdomain.com
EMAIL_FROM_NOTIFICATIONS=notifications@yourdomain.com
EMAIL_FROM_NOREPLY=noreply@yourdomain.com
EMAIL_FROM_NAME=Computer Server Labs
EMAIL_REPLY_TO=support@yourdomain.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-mailbox-password
```

- **From addresses:** verification → `EMAIL_FROM_VERIFY`, lab/alert emails → `EMAIL_FROM_NOTIFICATIONS`, password reset → `EMAIL_FROM_NOREPLY`.
- Use the **full mailbox address** as `SMTP_USER` and the **webmail password** from hPanel as `SMTP_PASS` (often your primary `noreply@` mailbox).
- Create each From address in hPanel (mailbox or alias allowed to send as that address).
- **Port 465** (SSL): `SMTP_PORT=465` and `SMTP_SECURE=true` (recommended).
- **Port 587** (STARTTLS): `SMTP_PORT=587` and omit `SMTP_SECURE` or set `SMTP_SECURE=false`.
- If login fails with `smtp.hostinger.com`, try `SMTP_HOST=smtp.titan.email` (some Hostinger mail uses Titan).

On startup, the API logs `[registry-api] SMTP ready` or a verify warning if credentials are wrong.

## Security

- Email/SMTP/API keys live **only** in server `.env` — never in the desktop app.
- Rate limiting enabled via `@fastify/rate-limit`.
- Verified labs require Ed25519 signature when `LAB_SIGNING_*` keys are configured.
- Audit log for verification/admin actions.

See [docs/online-services.md](../docs/online-services.md) for full setup.
