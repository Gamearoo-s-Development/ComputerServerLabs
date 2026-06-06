#!/bin/bash
# Apply lab.json files/directories manifest (runtime stage; template variables from env).
set -euo pipefail

apply_lab_files() {
  local manifest="/etc/sgq/lab-files-manifest.json"
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

def env_ctx():
    u = os.environ.get("SGQ_USERNAME") or os.environ.get("LAB_USERNAME") or "labuser"
    home = f"/home/{u}"
    return {
        "USERNAME": u,
        "PASSWORD": os.environ.get("SGQ_PASSWORD") or os.environ.get("LAB_PASSWORD") or "",
        "LAB_ID": os.environ.get("LAB_ID") or os.environ.get("SGQ_LAB_ID") or "lab",
        "SESSION_ID": os.environ.get("SESSION_ID") or os.environ.get("SGQ_SESSION_ID") or "",
        "FLAG_TEXT": os.environ.get("LAB_TRAINING_FLAG") or "",
        "FLAG_FILENAME": os.environ.get("LAB_FLAG_BASENAME") or ".hidden_flag",
        "FLAG_PATH": os.environ.get("LAB_FLAG_PATH") or f"{home}/.hidden_flag",
        "HOSTNAME": os.environ.get("HOSTNAME") or "lab-target",
        "RANDOM_PORT": os.environ.get("SGQ_RANDOM_PORT") or "32768",
        "RANDOM_SEED": os.environ.get("LAB_SESSION_SEED") or "",
    }

pat = re.compile(r"\{\{([A-Z0-9_]+)\}\}")

def render(s, ctx):
    if s is None:
        return ""
    return pat.sub(lambda m: ctx.get(m.group(1), m.group(0)), str(s))

def infer_stage(entry):
    stage = entry.get("stage")
    if stage in ("build", "runtime"):
        return stage
    blob = (entry.get("path") or "") + (entry.get("content") or "")
    return "runtime" if pat.search(blob) else "build"

ctx = env_ctx()

for d in data.get("directories") or []:
    if infer_stage(d) != "runtime":
        continue
    p = render(d.get("path"), ctx)
    if not p:
        continue
    pathlib.Path(p).mkdir(parents=True, exist_ok=True)
    mode = int(str(d.get("mode") or "0755"), 8)
    os.chmod(p, mode)
    owner = render(d.get("owner") or "", ctx)
    group = render(d.get("group") or owner, ctx)
    if owner:
        import pwd, grp
        try:
            uid = pwd.getpwnam(owner).pw_uid
            gid = grp.getgrnam(group).gr_gid if group else uid
            os.chown(p, uid, gid)
        except KeyError:
            pass

for entry in data.get("files") or []:
    if infer_stage(entry) != "runtime":
        continue
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
        import pwd, grp
        try:
            uid = pwd.getpwnam(owner).pw_uid
            gid = grp.getgrnam(group).gr_gid if group else uid
            os.chown(p, uid, gid)
        except KeyError:
            pass

print("apply_lab_files: runtime manifest applied", file=sys.stderr)
PY
}
