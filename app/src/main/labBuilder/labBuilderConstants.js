/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {{ id: string, label: string, image: string, trust: 'docker-official' | 'community' }} OfficialBaseImage */

/** @type {OfficialBaseImage[]} */
export const OFFICIAL_BASE_IMAGES = [
  { id: 'ubuntu-22.04', label: 'Ubuntu 22.04', image: 'ubuntu:22.04', trust: 'docker-official' },
  { id: 'ubuntu-24.04', label: 'Ubuntu 24.04', image: 'ubuntu:24.04', trust: 'docker-official' },
  { id: 'debian-bookworm', label: 'Debian Bookworm', image: 'debian:bookworm', trust: 'docker-official' },
  { id: 'alpine-latest', label: 'Alpine (latest)', image: 'alpine:latest', trust: 'docker-official' },
  { id: 'nginx-stable', label: 'NGINX (stable)', image: 'nginx:stable', trust: 'docker-official' },
  { id: 'node-lts', label: 'Node.js LTS', image: 'node:lts', trust: 'docker-official' },
  { id: 'python-3', label: 'Python 3', image: 'python:3', trust: 'docker-official' },
  { id: 'httpd-latest', label: 'Apache httpd', image: 'httpd:latest', trust: 'docker-official' }
]

/** @type {Record<string, { label: string, packages: string[], defaultPort?: number, healthCheck?: string, startupRoot?: string, startupUser?: string }>} */
export const SERVICE_CATALOG = {
  ssh: {
    label: 'OpenSSH',
    packages: ['openssh-server', 'passwd', 'login', 'procps', 'iproute2', 'bash'],
    defaultPort: 22,
    healthCheck: 'ss -tln | grep -q ":22 "',
    startupRoot: 'exec via start_lab_sshd',
    startupUser: 'root'
  },
  nginx: {
    label: 'NGINX',
    packages: ['nginx'],
    defaultPort: 80,
    healthCheck: 'curl -sf -o /dev/null http://127.0.0.1/ || test -f /var/run/nginx.pid',
    startupRoot: 'nginx',
    startupUser: 'root'
  },
  apache: {
    label: 'Apache httpd',
    packages: ['apache2'],
    defaultPort: 80,
    healthCheck: 'curl -sf -o /dev/null http://127.0.0.1/ || pgrep apache2',
    startupRoot: 'apache2ctl -D FOREGROUND',
    startupUser: 'root'
  },
  cron: {
    label: 'Cron',
    packages: ['cron'],
    healthCheck: 'pgrep cron || pgrep crond',
    startupRoot: 'cron -f',
    startupUser: 'root'
  },
  'python-http': {
    label: 'Python simple HTTP server',
    packages: ['python3'],
    defaultPort: 8000,
    healthCheck: 'ss -tln | grep -q ":8000 "',
    startupRoot: 'python3 -m http.server 8000 --directory /var/www/html',
    startupUser: 'root'
  }
}

export const TEMPLATE_VARIABLES = [
  { key: 'USERNAME', description: 'Generated lab username', secret: false },
  { key: 'PASSWORD', description: 'Generated session password', secret: true },
  { key: 'LAB_ID', description: 'Lab catalog id', secret: false },
  { key: 'SESSION_ID', description: 'Mission session id', secret: false },
  { key: 'FLAG_TEXT', description: 'Session training flag value', secret: true },
  { key: 'FLAG_FILENAME', description: 'Hidden flag filename', secret: false },
  { key: 'FLAG_PATH', description: 'Full path to hidden flag file', secret: true },
  { key: 'HOSTNAME', description: 'Container hostname', secret: false },
  { key: 'RANDOM_PORT', description: 'Placeholder for published host port', secret: false },
  { key: 'RANDOM_SEED', description: 'Session random seed', secret: false }
]
