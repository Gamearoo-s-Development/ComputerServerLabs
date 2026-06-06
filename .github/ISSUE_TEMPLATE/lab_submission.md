---
name: Lab submission
about: Propose a new hands-on lab
title: "[Lab]: "
labels: lab
assignees: ''
---

## Lab summary

| Field | Value |
|-------|-------|
| **Proposed ID** | e.g. `nginx-002` |
| **Title** | |
| **Difficulty** | Easy / Medium / Hard / Expert |
| **Category** | e.g. Linux, Docker, Networking |
| **Runtime** | docker (MVP only) |

## Learning objectives

What should the student be able to do after completing this lab?

## Scenario

Short narrative of the broken/misconfigured environment.

## Tasks (checklist)

1.
2.
3.

## Validation approach

Which validation type(s)? (`fileExists`, `command`, `serviceRunning`, etc.)

Validation must run **inside the container** — see [creating-labs.md](../../docs/creating-labs.md).

## Safety checklist

- [ ] No `--privileged` or host bind mounts required
- [ ] Credentials are lab-only (documented in README)
- [ ] No destructive host commands
- [ ] No download/execute of arbitrary internet scripts
- [ ] Dockerfile uses only files in the lab folder

## Docker / resources

- Base image:
- Approximate image size:
- Ports needed:

## Hints (outline)

1. (gentle)
2.
3.

## Contributor

- [ ] I can open a PR with `lab.json`, `Dockerfile`, and `README.md`
- [ ] I have read [creating-labs.md](../../docs/creating-labs.md) and [security-model.md](../../docs/security-model.md)

## Additional notes

Optional.
