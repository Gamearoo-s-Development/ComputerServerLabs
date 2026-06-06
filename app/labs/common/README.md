# Shared lab-target runtime scripts

Used by all Docker lab images when `buildPath` is `".."` (build context = `labs/`).

| Script | Role |
|--------|------|
| `sgq-entrypoint.sh` | Validates `SGQ_USERNAME` / `SGQ_PASSWORD`, creates user, configures SSH, runs `lab-setup.sh`, starts `sshd` |
| `apply-lab-credentials.sh` | User creation, password, home, sshd drop-in |
| `configure-lab-ssh-access.sh` | Legacy no-op (removes old SSH guards if present) |

Each lab adds `lab-setup.sh` for scenario-specific files (flags, decoys, broken configs).
