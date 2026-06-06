# shell-basics-001 — Shell Basics

Target-only lab: learners use the integrated terminal inside the lab container (no workstation jump box, no SSH required).

## Manual build

```bash
cd app/labs
docker build -f shell-basics-001/Dockerfile -t sysadmin-game/shell-basics-001:latest .
```

## Safety

Training container only. Session credentials are generated per run.
