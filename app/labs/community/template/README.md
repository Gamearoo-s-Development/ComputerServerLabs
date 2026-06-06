# Community lab template

Copy this folder to one of:

- `app/labs/community/examples/<your-track>/<your-lab-id>/` — ship as a sample with the repo
- `%AppData%/Computer Server Labs/online-labs/<your-lab-id>/` — sideload for local testing
- Upload as a `.zip` lab pack to the registry (when publishing is enabled)

## Required files

| File | Purpose |
|------|---------|
| `lab.json` | Lab definition (validated against `config/lab.schema.json`) |
| `README.md` | Author notes and learner overview |
| `Dockerfile` | Optional — required for runnable Docker labs |
| `lab-setup.sh` | Optional — seeds the container at start |
| `files/` | Optional static files copied into the image |
| `validators/` | Optional extra check scripts (document in README) |

## Safety rules

1. **Docker only** — set `"runtime": "docker"`.
2. **No host commands** — learners must not need access outside the container.
3. **No secrets in git** — use `"generatedPerSession": true` for credentials.
4. **No destructive host patterns** in scripts (the scanner blocks many unsafe paths).
5. **No privileged containers** unless you document why and get maintainer review.
6. Set `"bundled": false` for community-authored labs.

## Validation

Use objective auto-checks (`fileExists`, `command`, etc.) and a top-level `validation` block matching the schema. Invalid labs appear as **Invalid** in the browser and log errors in dev mode only.

## Publish checklist

- [ ] Unique `id` matching folder name
- [ ] Clear `objectivesPublic` with hints
- [ ] `postLabReview` summary for learners
- [ ] `safetyNotes` filled in
- [ ] Tested with **Lab Builder → Test** or a full app run
- [ ] README explains expected commands

See `lab.json` in this folder for a minimal valid example.
