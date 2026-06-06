# permissions-001 — File Permissions Repair

Practice fixing broken file permissions inside an isolated container. **Never run these steps on your host.**

## Training-only credentials

| Field    | Value |
|----------|-------|
| Username | `student` |
| Password | **Generated per session** when started from the app |

When testing manually, pass `-e LAB_USERNAME=student -e LAB_PASSWORD=training-only-manual` to `docker run`.
## Scenario

`/var/www/config/app.conf` is owned by `student` but has mode `000`, so even the owner cannot read it. Restore mode `644` so the config is readable.

## Manual test (without the app)

From the repository root:

```bash
cd labs/permissions-001
docker build -t sysadmin-game/permissions-001:latest .
docker run --rm -d -p 2223:22 \
  -e LAB_USERNAME=student \
  -e LAB_PASSWORD=training-only-manual \
  --name permissions-test sysadmin-game/permissions-001:latest
```

If port `2223` is busy, pick another host port (e.g. `-p 2233:22`).

### SSH

```bash
ssh student@127.0.0.1 -p 2223
```

Use the password from `LAB_PASSWORD` (or the app session panel).
### Objective

```bash
ls -l /var/www/config/app.conf
chmod 644 /var/www/config/app.conf
cat /var/www/config/app.conf
```

### Validation (app)

The app checks **inside the container only**:

- **Type:** `permission`
- **Path:** `/var/www/config/app.conf`
- **Expected mode:** `644`

Validation fails until mode `644` is set. Click **Validate / Check** in the lab session panel after fixing permissions.

### Cleanup

```bash
docker stop permissions-test
docker rm permissions-test
```

## Safety

- Non-privileged container
- No host volume mounts
- No host shell validation
