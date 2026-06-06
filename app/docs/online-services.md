# Online services (lab registry, accounts, sync)

Computer Server Labs supports an optional self-hosted **lab registry** with desktop integration. Production site: [computerserverlabs.com](https://computerserverlabs.com).

## Architecture

```
Desktop app (Electron main process)
  ├── onlineApiClient.js     → HTTP to registry API
  ├── onlineTokenStore.js    → safeStorage / encrypted fallback (tokens only)
  ├── onlineAuthManager.js   → device-code linking
  ├── onlineLabRegistry.js   → browse/download/install
  ├── labPackVerifier.js     → checksum, signature, schema, Docker safety
  └── onlineProgressSync.js  → XP/completions/achievements (no secrets)

Registry API (`website/api/`)       → Fastify + SQLite/MariaDB
Registry website (`website/`)       → Vite React SPA

Email notifications          → server-only (SMTP/Resend/SendGrid)
```

## Desktop app pages

- **Online Labs** — browse registry, download/import, unverified warning
- **Account** — link account, cloud sync toggle, leaderboard opt-in

Settings:

- `onlineApiBaseUrl` / `onlineWebsiteBaseUrl` — registry site (API at `/api` on same host). Packaged app default: `https://computerserverlabs.com`; dev/local Docker: `http://127.0.0.1:8080`
- `cloudSyncEnabled` (default `true`)
- `leaderboardOptIn` (default `false`)

## Lab trust levels

| Badge | Desktop behavior |
|-------|------------------|
| `official`, `verified` + valid signature | Shows **Verified Lab**; no extra prompt |
| `community`, `unverified` | Warning + confirmation before install/run |
| Failed checksum/signature | Blocked |

Installed online labs live under `%APPDATA%/…/online-labs/<labId>/` and appear in the local lab list with `source: 'online'`.

## Email notifications (secure)

The desktop app **cannot send arbitrary email**. There is no `POST /api/send-email` or equivalent.

Clients may only call:

```http
POST /api/notifications/trigger
Authorization: Bearer <access-token>
X-Device-Id: <device-id>

{ "event": "resend_verification" }
```

Allowed events: `resend_verification`, `password_reset`, `lab_update_notifications_enabled`, `security_alert_acknowledge`.

Server-only events (lab updates, leaderboard milestones, security alerts) are rejected if sent by clients.

Recipient is always `authenticatedUser.email` from the token — never from the request body.
Requests containing `to`, `recipient`, `email`, `subject`, `body`, or provider fields are rejected.

Rate limits: verification 5 min, password reset 10 min. All sends are audit-logged (no secrets/tokens logged).

Configure `website/api/.env.example` (copy to `website/api/.env` locally):

```env
EMAIL_PROVIDER=resend   # or console, smtp
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
EMAIL_REPLY_TO=support@computerserverlabs.com
```

The desktop app calls `POST /api/notifications/preferences` only — it never receives SMTP credentials.

## Lab verification process

1. Maintainer reviews submitted lab (Docker safety, no host mounts, no docker.sock, no privileged).
2. Admin marks version verified via `POST /api/admin/labs/:id/verify`.
3. Server signs checksum with Ed25519 (`LAB_SIGNING_PRIVATE_KEY`).
4. Desktop verifies signature before showing verified badge.

## Privacy

Cloud sync uploads:

- Completed labs, XP, achievements, best time, hints used, lab version

Never uploaded:

- Terminal command history
- Lab target passwords
- Session credentials
- Email passwords

## Self-hosting checklist

1. Deploy `website/api/` with HTTPS reverse proxy (production: **https://computerserverlabs.com**)
2. Set `PUBLIC_BASE_URL`, `WEBSITE_BASE_URL` to your public site URL, plus strong `JWT_SECRET`
3. Generate Ed25519 lab signing keys
4. Build `website/` or serve static files
5. Point desktop `onlineApiBaseUrl` to your API

## Templates

- Privacy policy: adapt `docs/templates/privacy-policy.template.md`
- Terms/disclaimer: adapt `docs/templates/terms.template.md`
