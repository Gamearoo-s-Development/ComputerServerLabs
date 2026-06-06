#!/bin/bash
# Apply lab.json files/directories manifest (runtime stage; template variables from env).
set -euo pipefail

apply_lab_files() {
  local manifest="${1:-/etc/sgq/lab-files-manifest.json}"
  if [ ! -f "$manifest" ]; then
    return 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "apply_lab_files: python3 required to process $manifest" >&2
    return 1
  fi

  python3 - "$manifest" <<'PY'
import json, os, pathlib, re, sys

manifest_path = sys.argv[1]
with open(manifest_path, "r", encoding="utf-8") as f:
    data = json.load(f)

pat = re.compile(r"\{\{([A-Z0-9_]+)\}\}")

def env_ctx():
    u = os.environ.get("SGQ_USERNAME") or os.environ.get("LAB_USERNAME") or "labuser"
    login_dir = os.environ.get("SGQ_LOGIN_DIR") or os.environ.get("LOGIN_DIR") or ""
    if not login_dir:
        login_dir = "/root" if u == "root" else f"/home/{u}"
    login_user = os.environ.get("SGQ_LOGIN_USER") or os.environ.get("LOGIN_USER") or u
    home = login_dir
    target_host = os.environ.get("TARGET_HOST") or os.environ.get("SGQ_TARGET_HOST") or "lab-target"
    target_ip = os.environ.get("TARGET_IP") or os.environ.get("SGQ_TARGET_INTERNAL_IP") or ""
    target_ssh = os.environ.get("TARGET_SSH_PORT") or os.environ.get("SGQ_TARGET_SSH_PORT") or "22"
    return {
        "USERNAME": u,
        "LOGIN_USER": login_user,
        "LOGIN_DIR": login_dir,
        "PASSWORD": os.environ.get("SGQ_PASSWORD") or os.environ.get("LAB_PASSWORD") or "",
        "LAB_ID": os.environ.get("LAB_ID") or os.environ.get("SGQ_LAB_ID") or "lab",
        "SESSION_ID": os.environ.get("SESSION_ID") or os.environ.get("SGQ_SESSION_ID") or "",
        "FLAG_TEXT": os.environ.get("LAB_TRAINING_FLAG") or "",
        "FLAG_FILENAME": os.environ.get("LAB_FLAG_BASENAME") or ".hidden_flag",
        "FLAG_PATH": os.environ.get("LAB_FLAG_PATH") or f"{home}/.hidden_flag",
        "HOSTNAME": os.environ.get("HOSTNAME") or "lab-target",
        "TARGET_HOST": target_host,
        "TARGET_IP": target_ip,
        "TARGET_SSH_PORT": target_ssh,
        "RANDOM_PORT": os.environ.get("SGQ_RANDOM_PORT") or "32768",
        "RANDOM_SEED": os.environ.get("LAB_SESSION_SEED") or "",
    }

def render(s, ctx):
    if s is None:
        return ""
    return pat.sub(lambda m: ctx.get(m.group(1), m.group(0)), str(s))

def infer_stage(entry):
    stage = entry.get("stage")
    if stage in ("build", "runtime"):
        return stage
    blob = (entry.get("path") or "") + (entry.get("content") or "") + (entry.get("target") or "")
    return "runtime" if pat.search(blob) else "build"

def chown_path(p, owner, group):
    if not owner:
        return
    import pwd, grp
    try:
        uid = pwd.getpwnam(owner).pw_uid
        gid = grp.getgrnam(group).gr_gid if group else uid
        os.chown(p, uid, gid)
    except KeyError as e:
        raise RuntimeError(f"unknown owner/group for {p}: {e}") from e

ctx = env_ctx()
errors = []

for d in data.get("directories") or []:
    if infer_stage(d) != "runtime":
        continue
    try:
        p = render(d.get("path"), ctx)
        if not p:
            continue
        pathlib.Path(p).mkdir(parents=True, exist_ok=True)
        mode = int(str(d.get("mode") or "0755"), 8)
        os.chmod(p, mode)
        owner = render(d.get("owner") or "", ctx)
        group = render(d.get("group") or owner, ctx)
        if owner:
            chown_path(p, owner, group)
    except Exception as e:
        errors.append(f"directory {d.get('path')}: {e}")

for entry in data.get("files") or []:
    if infer_stage(entry) != "runtime":
        continue
    if entry.get("type") == "symlink":
        continue
    try:
        p = render(entry.get("path"), ctx)
        if not p:
            continue
        pathlib.Path(os.path.dirname(p) or "/").mkdir(parents=True, exist_ok=True)
        content = render(entry.get("content") or "", ctx)
        with open(p, "w", encoding="utf-8") as out:
            out.write(content)
        mode = int(str(entry.get("mode") or "0644"), 8)
        os.chmod(p, mode)
        owner = render(entry.get("owner") or "", ctx)
        group = render(entry.get("group") or owner, ctx)
        if owner:
            chown_path(p, owner, group)
        if not os.path.isfile(p):
            raise RuntimeError("file missing after write")
    except Exception as e:
        errors.append(f"file {entry.get('path')}: {e}")

for entry in data.get("symlinks") or []:
    if infer_stage(entry) != "runtime":
        continue
    try:
        link = render(entry.get("path"), ctx)
        target = render(entry.get("target") or entry.get("content") or "", ctx)
        if not link or not target:
            continue
        if ".." in link or ".." in target:
            raise RuntimeError("symlink paths cannot contain ..")
        pathlib.Path(os.path.dirname(link) or "/").mkdir(parents=True, exist_ok=True)
        if os.path.lexists(link):
            os.remove(link)
        os.symlink(target, link)
        owner = render(entry.get("owner") or "", ctx)
        group = render(entry.get("group") or owner, ctx)
        if owner:
            chown_path(link, owner, group)
    except Exception as e:
        errors.append(f"symlink {entry.get('path')}: {e}")

if errors:
    for err in errors:
        print(f"apply_lab_files: ERROR: {err}", file=sys.stderr)
    sys.exit(1)

print("apply_lab_files: runtime manifest applied", file=sys.stderr)
PY
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    echo "apply_lab_files: failed to apply $manifest" >&2
    return 1
  fi
  return 0
}
