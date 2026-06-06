# beginner-linux-001 — First Linux Login

MVP gate lab. All work happens **inside the container** — never on your host shell.

## Training-only credentials

| Field    | Value |
|----------|-------|
| Username | `student` (from `lab.json`) |
| Password | **Generated per session** when started from the app |

The app shows the SSH command and session password in the lab session panel. Passwords are never hardcoded in `lab.json` or Docker images.

## Hidden flag

After SSH login, find `/home/student/.hidden_flag` (hidden file). It contains a short training message.

## Manual test (without the app)

From the repository root:

```bash
cd labs/beginner-linux-001
docker build -t sysadmin-game/beginner-linux-001:latest .
docker run --rm -d -p 2222:22 \
  -e LAB_USERNAME=student \
  -e LAB_PASSWORD=training-only-manual \
  --name beginner-linux-test sysadmin-game/beginner-linux-001:latest
```

If port `2222` is busy, pick another host port (e.g. `-p 2223:22`) and use that in SSH.

### SSH from your terminal

```bash
ssh student@127.0.0.1 -p 2222
```

Use the password you passed in `LAB_PASSWORD` (or the password shown in the app session panel).

### Complete objectives inside the container

```bash
ls -la ~
cat ~/.hidden_flag
mark-lab-complete
# or: touch /tmp/lab-complete
```

### Validation (app)

The app checks **inside the container only**:

- **Type:** `fileExists`
- **Path:** `/tmp/lab-complete`

Validation fails until that file exists. After `touch /tmp/lab-complete`, click **Validate / Check** in the lab session panel to earn XP.

### Cleanup

```bash
docker stop beginner-linux-test
docker rm beginner-linux-test
```

## Safety

- Non-privileged container
- No host volume mounts
- No host shell validation
- Integrated terminal (in app) attaches via `docker exec` only
