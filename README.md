# Computer Server Labs monorepo

Hands-on server, system, Docker, Linux, and Windows lab training (desktop app) and an optional online lab registry at [computerserverlabs.com](https://computerserverlabs.com).

## Repository layout

```
SysAdminGame/
├── app/          Electron desktop app (labs, config, docs, Docker workstations)
├── website/      Registry SPA + api/ backend (auth, sync, leaderboards)
├── shared/       Shared schemas, types, and lab-format utilities
├── package.json  npm workspace root
└── README.md
```

## Quick start

Install dependencies once at the repo root:

```bash
npm install
```

### Desktop app

```bash
npm run dev:app
```

Labs, config, and docs live under `app/`. The packaged Electron app ships those folders via `extraResources`.

### Registry website

```bash
npm run dev:website
```

Frontend only (Vite on port 5174). API separately:

```bash
npm run dev:api
```

Docker (website + API + MariaDB):

```bash
cd website
cp .env.docker.example .env.docker
docker compose up --build
```

Production registry: **https://computerserverlabs.com**

## Build

```bash
npm run build:app
npm run build:website
```

## Shared package

`@sysadmin-game/shared` holds workstation helpers, session network logic, branding constants, and `lab-format/lab.schema.json`. Both the app and website tooling import from this package via npm workspaces.

## License

MPL-2.0 — see [LICENSE](LICENSE).
