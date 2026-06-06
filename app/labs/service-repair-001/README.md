# service-repair-001 — Failed Service

Repair a broken systemd-style unit inside an isolated container. The lab uses a minimal `systemctl` implementation so the scenario works on Windows and Linux without privileged containers.

## Training-only credentials

| Field    | Value |
|----------|-------|
| Username | `student` |
| Password | **Generated per session** when started from the app |

The student account has passwordless `sudo` **inside this lab only** for unit repair tasks. For manual `docker run`, pass `-e LAB_USERNAME=student -e LAB_PASSWORD=training-only-manual`.
## Scenario

`training-agent.service` points at a missing script (`/opt/training-agent/broken-start.sh`). Fix the unit to use `/opt/training-agent/run.sh`, reload systemd, and start the service.

## Manual test (without the app)

From the repository root:

```bash
cd labs/service-repair-001
docker build -t sysadmin-game/service-repair-001:latest .
docker run --rm -d -p 2226:22 \
  -e LAB_USERNAME=student \
  -e LAB_PASSWORD=training-only-manual \
  --name service-repair-test sysadmin-game/service-repair-001:latest
```

If port `2226` is busy, pick another host port.

### SSH

```bash
ssh student@127.0.0.1 -p 2226
```

Use the password from `LAB_PASSWORD` (or the app session panel).
### Objective

```bash
systemctl status training-agent.service
sudo nano /etc/systemd/system/training-agent.service
# Change ExecStart=/opt/training-agent/run.sh
sudo systemctl daemon-reload
sudo systemctl start training-agent.service
systemctl is-active training-agent.service
```

Expected: `active`

### Validation (app)

The app checks **inside the container only**:

- **Type:** `serviceRunning`
- **Service:** `training-agent.service`

Validation passes when `systemctl is-active training-agent.service` reports `active`.

### Cleanup

```bash
docker stop service-repair-test
docker rm service-repair-test
```

## Safety

- Non-privileged container
- No host volume mounts
- No host shell validation
