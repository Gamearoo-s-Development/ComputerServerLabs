# Bundled vs community labs

Computer Server Labs ships two kinds of local lab content plus registry downloads.

## Bundled labs

- **Location:** `app/labs/bundled/<track>/<lab-id>/` or legacy flat `app/labs/<lab-id>/`
- **Ship with the installer** via `electron-builder` `extraResources`
- **Polished** definitions with `Dockerfile`, `lab-setup.sh`, objectives, hints, and validation
- **`"bundled": true`** in `lab.json` (also inferred from folder)
- **Offline:** runnable after the Docker image is built once

## Community labs

### Examples (in repo)

- **Location:** `app/labs/community/examples/<track>/<lab-id>/`
- **`"bundled": false`**
- Often **advanced or experimental** — may ship without a Dockerfile (shows as Scaffold until you add one)
- Safe for browsing and authoring reference

### Installed (downloaded)

- **Location:** `{userData}/online-labs/<lab-id>/`
- Installed from the **Online Labs** registry or sideloaded zip packs
- **`source: online`** in the catalog API
- Subject to community disclaimer before first start

## Discovery and validation

The main process scans all roots via `labCatalogDiscovery.js`:

1. Legacy flat folders under `labs/`
2. `labs/bundled/*/*`
3. `labs/community/examples/*/*`
4. Installed online labs

Each `lab.json` is validated with AJV against `config/lab.schema.json`. Invalid labs:

- Do **not** crash the app
- Show as **Invalid** in the browser (optional hide via filter)
- Log details in **developer mode** only

## UI filters

The Labs browser supports:

- **Pack** filter: Bundled, Community examples, Installed, etc.
- **Category** and **Difficulty**
- **Search** across title, description, id, and **tags**

## Adding a new community lab

1. Copy `app/labs/community/template/` to `community/examples/<track>/<your-lab-id>/`
2. Edit `lab.json` — unique `id`, objectives, validation, `"bundled": false`
3. Add `Dockerfile` + `lab-setup.sh` (see bundled examples) for a runnable lab
4. Run the app — lab appears under **Community examples**
5. Optional: publish as a zip pack to the registry

Regenerate scaffold catalog labs (does not overwrite existing folders):

```bash
node scripts/generate-lab-catalog.mjs
```

See also [creating-labs.md](./creating-labs.md) and [../labs/README.md](../labs/README.md).
