/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {'ubuntu' | 'debian' | 'kali' | 'windows'} DesktopRuntimeKey */

export const DESKTOP_RUNTIME_KEYS = /** @type {DesktopRuntimeKey[]} */ ([
  'ubuntu',
  'debian',
  'kali',
  'windows'
])

/** Recommended community presets — not auto-trusted. */
export const DESKTOP_RUNTIME_PRESETS = {
  ubuntu: [
    {
      id: 'webtop-ubuntu-kde',
      label: 'LinuxServer Webtop — Ubuntu KDE',
      image: 'lscr.io/linuxserver/webtop:ubuntu-kde',
      source: 'LinuxServer.io (community)',
      trustNote: 'Third-party desktop image. Review before trusting.'
    },
    {
      id: 'webtop-ubuntu-xfce',
      label: 'LinuxServer Webtop — Ubuntu XFCE',
      image: 'lscr.io/linuxserver/webtop:ubuntu-xfce',
      source: 'LinuxServer.io (community)',
      trustNote: 'Third-party desktop image. Review before trusting.'
    }
  ],
  debian: [
    {
      id: 'webtop-debian-xfce',
      label: 'LinuxServer Webtop — Debian XFCE',
      image: 'lscr.io/linuxserver/webtop:debian-xfce',
      source: 'LinuxServer.io (community)',
      trustNote: 'Third-party desktop image. Review before trusting.'
    }
  ],
  kali: [
    {
      id: 'kali-rolling-desktop',
      label: 'Kali Rolling — XFCE + noVNC (official base)',
      image: 'sysadmin-game/kali-desktop:latest',
      source: 'Built locally from kalilinux/kali-rolling',
      trustNote: 'Matches kali-terminal base image. First start builds the image (several GB).'
    },
    {
      id: 'webtop-kali-xfce',
      label: 'LinuxServer Webtop — Kali XFCE (community)',
      image: 'lscr.io/linuxserver/webtop:kali-linux-xfce',
      source: 'LinuxServer.io (community)',
      trustNote: 'Third-party desktop image. Review before trusting.'
    }
  ],
  windows: [
    {
      id: 'dockurr-windows',
      label: 'Dockur Windows VM',
      image: 'dockurr/windows:latest',
      source: 'Dockur (community)',
      trustNote: 'Windows VM in Docker/QEMU. Requires KVM and sufficient RAM/disk.'
    }
  ]
}

export const DESKTOP_RUNTIME_RESOURCE_HINTS = {
  ubuntu: 'Recommend 2–4 GB RAM and 5+ GB disk for Linux desktop containers.',
  debian: 'Recommend 2–4 GB RAM and 5+ GB disk for Linux desktop containers.',
  kali: 'Kali desktop images are larger — allow 4+ GB RAM and 10+ GB disk.',
  windows: 'Windows desktop VMs may need 4+ GB RAM, 20+ GB disk, and KVM.'
}
