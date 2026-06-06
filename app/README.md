# Computer Server Labs desktop app

Electron + React lab platform with Docker workstations. Part of the [Computer Server Labs](https://computerserverlabs.com) monorepo.

## Development

From the repo root:

```bash
npm run dev:app
```

Or from this directory:

```bash
npm run dev
```

## Structure

```
app/
├── src/
│   ├── main/       Electron main process (Docker, labs, IPC)
│   └── renderer/   React UI
├── labs/           Bundled lab definitions and Dockerfiles
├── config/         App defaults and workstation profiles
├── docs/           Developer documentation
└── assets/         Icons and static assets
```

Imports from `@sysadmin-game/shared` (npm workspace package at `../shared/`).

## Packaging

```bash
npm run dist
```

See [docs/windows-build.md](docs/windows-build.md) and [electron-builder.yml](electron-builder.yml).
