# disk-cleanup-001 — Disk Cleanup

Practice finding and removing large fake log files inside an isolated container.

## Training-only credentials

| Field    | Value |
|----------|-------|
| Username | `student` |
| Password | **Generated per session** when started from the app |

For manual `docker run`, pass `-e LAB_USERNAME=student -e LAB_PASSWORD=training-only-manual`.
## Scenario

`/var/log/staging` contains several oversized fake log files that fill the partition. Remove enough data so usage drops below the lab threshold or delete `large.log`.

## Manual test (without the app)

From the repository root:

```bash
cd labs/disk-cleanup-001
docker build -t sysadmin-game/disk-cleanup-001:latest .
docker run --rm -d -p 2225:22 \
  -e LAB_USERNAME=student \
  -e LAB_PASSWORD=training-only-manual \
  --name disk-cleanup-test sysadmin-game/disk-cleanup-001:latest
```

If port `2225` is busy, pick another host port.

### SSH

```bash
ssh student@127.0.0.1 -p 2225
```

Use the password from `LAB_PASSWORD` (or the app session panel).
### Objective

```bash
df -h /var/log/staging
du -sh /var/log/staging/*
rm /var/log/staging/large.log
df -h /var/log/staging
```

You may remove additional archive logs if needed.

### Validation (app)

The app runs **inside the container only**:

- **Type:** `command`
- **Command:** `/opt/lab/verify-cleanup`

The script passes when partition usage is below 70% **or** `large.log` has been removed.

### Cleanup

```bash
docker stop disk-cleanup-test
docker rm disk-cleanup-test
```

## Safety

- Non-privileged container
- No host volume mounts
- Only fake log data inside the container is affected
