# Lab Builder (Developer Mode)

The **Lab Builder** is an optional authoring surface for **Docker** training labs. It is hidden unless **Developer Mode** is enabled in **Settings**.

## Lab Builder wizard

The builder uses a **13-step wizard** (replacing the old flat tabs):

1. Basic Info — title, id, difficulty, tasks, unlock rules  
2. Runtime / Containers — single container or docker-compose, Dockerfile generation  
3. Target Filesystem — files, folders, imports, `{{LOGIN_DIR}}` templates  
4. Optional Workstation — custom investigation image (never root)  
5. Services & Ports — SSH, NGINX, web routes, health exposure  
6. Objectives — visible/hidden/required, auto-check types  
7. Questions — text / regex / multiple accepted answers  
8. Hints — ordered hint list  
9. Ticket / Scenario — incident narrative, attachments  
10. Validation — final check (container-only) + `validate.sh`  
11. Safety Review — export/build gate  
12. Generated Files — plain-English summary + file preview  
13. Save / Export — draft save, folder/zip export, Docker Build/Test  

Use **Import** on the Filesystem step to copy files or folders from your PC into the draft (`labBuilder:importAssets`).

Multi-container labs set `docker.layout` to `compose` and generate `docker-compose.yml` on save.

## Where drafts live

Drafts are stored only under Electron `userData`, not in the bundled `labs/` tree:

```text
<userData>/lab-builder/drafts/<uuid>/
  lab.json
  Dockerfile
  entrypoint.sh
  validate.sh
  README.md
  manifest.json   # app metadata (not exported)
```

See `DATA_FOLDER.txt` in your data root for the full layout.

## Safety and schema

- **Schema:** `lab.json` is validated against `config/lab.schema.json` (same rules as catalog labs where applicable).
- **Analyzer:** Dockerfile, scripts, readme, and key JSON fields are scanned for risky patterns (`src/main/labBuilderSafety.js`). **Blocked** findings prevent **export** and **Build/Test** unless you enable the **dev-only** unsafe override (unpackaged builds only).

Normal **Safety Mode** for learners is unchanged elsewhere in the app.

## Filesystem setup (target vs workstation)

Use the **Filesystem** tab to define what learners see when they log in:

| Scope | Container | Login directory |
|-------|-----------|-----------------|
| **Lab target** | Broken service / server under repair | `/home/{{USERNAME}}` for normal users, `/root` only when root mode is enabled |
| **Workstation** | Investigation shell (SSH client, notes) | Always `/home/{{USERNAME}}` — workstations never start as root |

`lab.json` stores manifests under `filesystem.target` and `filesystem.workstation` (files, directories, optional symlinks). Legacy top-level `files` / `directories` sync into `filesystem.target` on save.

**Template variables** (rendered at runtime unless marked build-time): `{{LOGIN_DIR}}`, `{{LOGIN_USER}}`, `{{USERNAME}}`, `{{PASSWORD}}`, `{{LAB_ID}}`, `{{SESSION_ID}}`, `{{TARGET_HOST}}`, `{{TARGET_IP}}`, `{{FLAG_TEXT}}`, `{{FLAG_FILENAME}}`, `{{FLAG_PATH}}`, and related flags.

**Quick path:** “Place file in login directory” writes `{{LOGIN_DIR}}/filename` for the target or `/home/{{USERNAME}}/filename` on the workstation.

**Root labs** (`targetUser.mode: "root"` and `allowRoot: true`) are for intentional admin/repair scenarios only. The builder shows a warning; paths under `/root` are blocked unless root mode is on.

Runtime application is handled by `labs/common/apply-lab-files.sh` during container startup; failures abort the session so broken labs do not start half-configured.

## Command Guide and red herrings (authoring support)

Labs can optionally include:

- `commandGuide`: categories + a mixed pool of suggested commands and plausible distractions
- `redHerrings`: optional structured “decoy” objects (files, services, logs) for design clarity

Red herrings should teach troubleshooting habits, not trick learners unfairly. Avoid decoys that waste large amounts of time or require guessing.

## Public vs internal objectives

Use **`objectivesPublic`** for learner-facing checklist text and **`objectives`** for auto-checks, paths, and answer keys. Keep **`validation`** and **`setupSecrets`** internal. See [creating-labs.md — Public objectives vs internal validation](creating-labs.md#public-objectives-vs-internal-validation-no-answer-leakage).

## Docker image sources

When authoring `docker` in a draft, choose:

| Source | `docker.imageSource` | Notes |
|--------|----------------------|--------|
| **Local build** | `local-build` | Uses `docker.buildPath` + Dockerfile in the draft. Shown as **Local Build Image** — authors must review the Dockerfile. |
| **Prebuilt** | `prebuilt` | Pull from Docker Hub or MCR (e.g. `nginx`, `mcr.microsoft.com/windows/servercore`). UI shows a trust badge (Docker Official, Microsoft Official, Verified Project, Community, or Unverified). |

Windows container images require a Windows host with Docker Desktop **Windows containers** enabled. They are terminal/server workloads — not Windows desktop.

## Build/Test (Docker)

**Build/Test** builds (or refreshes) the image from your draft folder, starts a **managed Docker session**, and attaches the usual session UI. Sessions are marked as **Lab Builder tests**:

- Successful validation **does not** award XP or write catalog completions.
- Stopping uses `labBuilder:stopTestSession` (builder sessions cannot be mistaken for learner runs in teardown logic).

## Import / export

- **Import:** copy a lab folder into a new draft (must contain `lab.json`).
- **Export:** write a portable folder or zip with the standard lab files (`manifest.json` is stripped from folder exports).

## IPC surface

Renderer code must use **`window.api.labBuilder.*`** defined in `src/main/preload.js` — no raw filesystem or shell access from the UI.

---

*See also:* [creating-labs.md](creating-labs.md), [security-model.md](security-model.md).
