# Lab catalog roadmap (post-MVP)

Expanded lab catalog beyond the five MVP starter labs. **Docker-first** on Windows and Linux; VM labs follow viewer/RDP planning in [vm-rdp-viewer.md](vm-rdp-viewer.md).

## Tier 1 — Starter (MVP)

| ID | Title | Focus |
|----|-------|-------|
| beginner-linux-001 | First Linux Login | SSH, hidden files |
| permissions-001 | File Permissions Repair | chmod/chown |
| nginx-001 | Broken NGINX | web config |
| disk-cleanup-001 | Disk Cleanup | storage |
| service-repair-001 | Failed Service | systemd-style units |

## Tier 2 — Core sysadmin

| Planned ID | Title | Focus |
|------------|-------|-------|
| firewall-001 | Basic iptables/nft | packet filter |
| cron-001 | Scheduled jobs | crontab repair |
| users-001 | Local accounts | user/group admin |
| package-001 | Package manager | apt repair |

## Tier 3 — Multi-service

| Planned ID | Title | Focus |
|------------|-------|-------|
| lamp-001 | LAMP stack | apache+mysql |
| dns-001 | BIND basics | zone file |
| mail-001 | Postfix queue | mail troubleshooting |

## Tier 4 — VM (future)

| Planned ID | Title | Runtime |
|------------|-------|---------|
| hypervisor-vbox-001 | VirtualBox NAT | virtualbox |
| win-rdp-001 | Windows Server RDP | hyperv / vmware |

## Authoring requirements

- No hardcoded passwords in `lab.json` — use `generatedPerSession: true`
- Objectives with `autoCheck` where possible
- Validation inside container/VM only
- MPL-2.0 headers in new source files

Submit labs via [.github/ISSUE_TEMPLATE/lab_submission.md](../.github/ISSUE_TEMPLATE/lab_submission.md).
