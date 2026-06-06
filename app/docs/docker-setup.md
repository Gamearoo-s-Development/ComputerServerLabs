# Docker Setup

Labs in the MVP require **Docker** on **Windows 10/11** or **Linux**. The app uses the Docker CLI (`docker`) from the Electron main process—it does not embed the Docker engine.

**macOS is not supported** for the desktop app at this time.

---

## Windows (Docker Desktop)

### Install

1. Download [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
2. Enable **WSL 2** backend when prompted (recommended)
3. Restart if the installer requests it
4. Start **Docker Desktop** and wait until the engine reports **Running**

### Verify

```powershell
docker --version
docker info
```

Both should succeed without “cannot connect to daemon” errors.

### Windows container workstations (optional)

Some labs offer a **Docker Windows PowerShell** workstation. This is a **Windows Server container terminal** — not a full Windows desktop VM.

- Requires Docker Desktop on **Windows 10/11**
- Docker must be switched to **Windows containers** mode (tray icon → *Switch to Windows containers*). The app does **not** change this for you.
- **Linux containers** remain the default and work for most labs
- In **Settings → Lab Workstation**, use **Test Windows container support** or the workstation picker’s status panel to verify your setup
- [Microsoft: Set up your environment for Windows containers](https://learn.microsoft.com/virtualization/windowscontainers/quick-start/set-up-environment)

### Common issues

| Symptom | Fix |
|---------|-----|
| Docker CLI missing | Reinstall Docker Desktop; ensure “Add to PATH” is enabled |
| Daemon not running | Open Docker Desktop; check WSL 2 is installed (`wsl --status`) |
| Virtualization disabled | Enable Intel VT-x / AMD-V in BIOS; enable Hyper-V/WSL features per Docker docs |
| Windows workstation greyed out | Docker is in Linux mode — switch to Windows containers or use a Linux workstation |
| Port in use for labs | App will pick alternate host ports when possible (later phase) |

### WSL 2

Docker Desktop on Windows often uses WSL 2. Install via:

```powershell
wsl --install
```

See [Microsoft WSL documentation](https://learn.microsoft.com/en-us/windows/wsl/install).

---

## Linux (Docker Engine)

### Install

Use your distribution’s official steps:

- [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Install on Fedora](https://docs.docker.com/engine/install/fedora/)
- [Generic Linux](https://docs.docker.com/engine/install/)

### Post-install

Add your user to the `docker` group (logout/login required):

```bash
sudo usermod -aG docker $USER
```

### Verify

```bash
docker --version
docker info
docker run --rm hello-world
```

### Common issues

| Symptom | Fix |
|---------|-----|
| Permission denied on socket | Add user to `docker` group or use `sudo` (group preferred) |
| Service not running | `sudo systemctl enable --now docker` |
| KVM / virtualization | Needed for some VM tools; labs only need Docker for MVP |

---

## What the app checks

The **Health** page (sidebar) probes:

- `docker --version` — CLI installed
- `docker info` — daemon running

Other tools (WSL, VirtualBox, Hyper-V, QEMU) are informational for future VM labs.

---

## Safety reminder

- Labs run in **containers**, not directly on your host OS
- Keep **Safety Mode** enabled unless you understand the risks ([security-model.md](security-model.md))
- Lab credentials are **training-only**

---

## Next steps

1. Confirm Docker is **Running** in the app Health dashboard
2. Continue the [MVP build checklist](MVP_STEP_BY_STEP.md) from Phase 4 onward
3. When labs ship, build the gate lab: `labs/beginner-linux-001/`
