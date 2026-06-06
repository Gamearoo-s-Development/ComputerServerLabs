# Lab packs

Computer Server Labs stores lab content under this directory. The app discovers labs from several roots while keeping shared runtime assets at the top level.

## Layout

```text
labs/
  common/              Shared entrypoint + SSH helpers (build context)
  _shared/             Workstation images and terminal helper
  bundled/             Official labs that ship with the installer
    linux-basics/
    file-permissions/
    networking/
    docker/
    web-server/
    databases/
    security-basics/
    troubleshooting/
    windows-concepts/
  community/
    template/          Starter pack for authors
    examples/          Sample community labs (advanced / experimental)
  <legacy-id>/         Original flat lab folders (still supported)
```

## Bundled vs community

| Type | Location | Ships with app | Runnable offline |
|------|----------|----------------|------------------|
| **Bundled** | `bundled/` or legacy flat folder | Yes | Yes (after image build) |
| **Community examples** | `community/examples/` | Yes (definitions) | When Dockerfile present |
| **Installed community** | `%AppData%/.../online-labs/` | No (downloaded) | After install |

Each `lab.json` may set `"bundled": true|false`. The loader also tags labs by folder (`source`: `bundled`, `community`, or `online`).

## Regenerating catalog labs

Educational scaffold labs can be regenerated safely (skips existing folders):

```bash
node scripts/generate-lab-catalog.mjs
```

## Docker build context

Nested labs use `"buildPath": ".."` so the build context is the **`labs/` tree root**, allowing `COPY common/...` and `COPY bundled/<track>/<id>/lab-setup.sh`.

## Adding a community lab

See [docs/creating-labs.md](../docs/creating-labs.md) and copy `community/template/` as a starting point.
