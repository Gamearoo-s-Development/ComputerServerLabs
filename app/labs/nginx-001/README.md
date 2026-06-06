# nginx-001 — Broken NGINX

Repair a broken NGINX site configuration inside an isolated container.

## Training-only credentials

| Field    | Value |
|----------|-------|
| Username | `student` |
| Password | **Generated per session** when started from the app |

The student account has passwordless `sudo` **inside this lab only** for service repair tasks. For manual `docker run`, pass `-e LAB_USERNAME=student -e LAB_PASSWORD=training-only-manual`.
## Scenario

`/etc/nginx/sites-enabled/training.conf` contains a syntax error (missing semicolon). NGINX is not running until you fix the file and start it.

## Manual test (without the app)

From the repository root:

```bash
cd labs/nginx-001
docker build -t sysadmin-game/nginx-001:latest .
docker run --rm -d -p 2224:22 -p 8080:80 \
  -e LAB_USERNAME=student \
  -e LAB_PASSWORD=training-only-manual \
  --name nginx-test sysadmin-game/nginx-001:latest
```

Adjust host ports if `2224` or `8080` are busy.

### SSH

```bash
ssh student@127.0.0.1 -p 2224
```

Use the password from `LAB_PASSWORD` (or the app session panel).
### Objective

```bash
sudo nginx -t
sudo nano /etc/nginx/sites-enabled/training.conf
# Add the missing semicolon after "listen 80"
sudo nginx -t
sudo nginx
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
```

Expected HTTP status: `200`

From your host (optional):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/
```

### Validation (app)

The app runs **curl inside the container**:

- **Type:** `httpResponse`
- **URL:** `http://127.0.0.1/`
- **Expected status:** `200`

Validation fails until NGINX serves HTTP 200 on port 80 inside the container.

### Cleanup

```bash
docker stop nginx-test
docker rm nginx-test
```

## Safety

- Non-privileged container
- No host volume mounts
- Sudo is scoped to the training container only
