# Contributing to Computer Server Labs

Thank you for helping improve **Computer Server Labs** — a community-built platform for practicing server, system, Docker, Linux, Windows, and troubleshooting skills.

Website: [computerserverlabs.com](https://computerserverlabs.com)

## Code of conduct

Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Getting started

### Prerequisites

- Node.js 20+
- Docker Desktop (for running labs)
- Git

### Clone and install

```bash
git clone https://github.com/<your-org>/SysAdmin-Game-Quizes.git
cd SysAdminGame
npm install
```

### Run the desktop app

```bash
npm run dev:app
```

### Run the registry website (optional)

```bash
npm run dev:website
npm run dev:api
```

## Submitting changes

1. Fork the repository and create a feature branch.
2. Keep changes focused; match existing code style.
3. Run lint/tests where applicable (`npm run lint:app`, `npm --workspace app run test:lab-builder`).
4. Open a pull request with a clear description and test plan.

## Submitting labs

See [app/docs/creating-labs.md](app/docs/creating-labs.md) and the lab submission issue template.

## Security

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

Contributions are licensed under MPL-2.0, consistent with the project.
