/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export const LAB_CATEGORIES = [
  { id: 'linux', title: 'Linux', description: 'Shell, permissions, services', labs: 0, phase: 2, accent: 'text-accent' },
  { id: 'docker', title: 'Docker', description: 'Containers & compose', labs: 0, phase: 3, accent: 'text-success' },
  { id: 'networking', title: 'Networking', description: 'DNS, routing, firewalls', labs: 0, phase: 4, accent: 'text-warning' },
  { id: 'web', title: 'Web Hosting', description: 'NGINX, TLS, uptime', labs: 0, phase: 2, accent: 'text-accent' },
  { id: 'databases', title: 'Databases', description: 'SQL, backups, recovery', labs: 0, phase: 3, accent: 'text-muted' },
  { id: 'security', title: 'Security Simulation', description: 'CTF-style isolated practice labs', labs: 0, phase: 4, accent: 'text-danger' },
  { id: 'incident', title: 'Incident Recovery', description: 'Outages & forensics', labs: 0, phase: 5, accent: 'text-warning' }
]

export const PHASE_ROADMAP = [
  { phase: 1, title: 'Onboarding & Quizzes', status: 'active', detail: 'Lab operations, quizzes, Health Checks' },
  { phase: 2, title: 'Linux Labs', status: 'upcoming', detail: 'SSH, permissions, systemd' },
  { phase: 3, title: 'Docker Ops', status: 'upcoming', detail: 'Container challenge scenarios' },
  { phase: 4, title: 'Networking', status: 'upcoming', detail: 'Multi-host routing labs' },
  { phase: 5, title: 'Incident Response', status: 'upcoming', detail: 'Outage sims & recovery runs' }
]
