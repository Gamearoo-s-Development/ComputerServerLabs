#!/usr/bin/env node
/**
 * Generates bundled + community lab catalog definitions under app/labs/.
 * Safe, educational, Docker-only scaffold labs with lab.json + README (+ Dockerfile for bundled).
 *
 * Usage: node scripts/generate-lab-catalog.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  buildUnlockRequirements,
  xpForDifficulty
} from '../shared/lab-format/labProgression.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const LABS_ROOT = path.join(REPO_ROOT, 'app', 'labs')

const DIFFICULTY = {
  beginner: 'Easy',
  intermediate: 'Medium',
  advanced: 'Hard'
}

const XP = { Easy: 50, Medium: 80, Hard: 110, Expert: 150 }

function xpRewardFor(spec) {
  const difficulty = DIFFICULTY[spec.tier]
  return xpForDifficulty(difficulty) ?? XP[difficulty] ?? 60
}

/** @type {{ track: string, category: string, bundled: boolean, labs: { slug: string, title: string, tier: keyof typeof DIFFICULTY, topic: string, minutes: number }[] }[]} */
const CURRICULUM = [
  {
    track: 'linux-basics',
    category: 'Linux Basics',
    bundled: true,
    labs: [
      { slug: 'linux-nav-003', title: 'Directory Navigation', tier: 'beginner', topic: 'cd, pwd, and ls', minutes: 15 },
      { slug: 'linux-paths-004', title: 'Absolute vs Relative Paths', tier: 'beginner', topic: 'path resolution', minutes: 15 },
      { slug: 'linux-man-005', title: 'Using man and --help', tier: 'beginner', topic: 'documentation', minutes: 20 },
      { slug: 'linux-history-006', title: 'Command History', tier: 'beginner', topic: 'history and recall', minutes: 15 },
      { slug: 'linux-pipes-007', title: 'Pipes and Redirection', tier: 'beginner', topic: 'stdout/stderr', minutes: 25 },
      { slug: 'linux-grep-008', title: 'Search with grep', tier: 'beginner', topic: 'text filtering', minutes: 20 },
      { slug: 'linux-find-009', title: 'Find Files by Name', tier: 'beginner', topic: 'find basics', minutes: 25 },
      { slug: 'linux-head-tail-010', title: 'head and tail', tier: 'beginner', topic: 'log snippets', minutes: 15 },
      { slug: 'linux-wc-011', title: 'Count Lines and Words', tier: 'beginner', topic: 'wc utility', minutes: 15 },
      { slug: 'linux-sort-uniq-012', title: 'sort and uniq', tier: 'intermediate', topic: 'log deduplication', minutes: 25 },
      { slug: 'linux-cut-013', title: 'Extract Columns with cut', tier: 'intermediate', topic: 'field parsing', minutes: 20 },
      { slug: 'linux-awk-intro-014', title: 'awk Introduction', tier: 'intermediate', topic: 'column reports', minutes: 30 },
      { slug: 'linux-env-015', title: 'Environment Variables', tier: 'intermediate', topic: 'env and export', minutes: 20 },
      { slug: 'linux-alias-016', title: 'Shell Aliases', tier: 'beginner', topic: 'productivity shortcuts', minutes: 15 },
      { slug: 'linux-processes-017', title: 'List Processes', tier: 'intermediate', topic: 'ps and top basics', minutes: 25 },
      { slug: 'linux-signals-018', title: 'Stop a Runaway Process', tier: 'intermediate', topic: 'kill and signals', minutes: 25 },
      { slug: 'linux-exit-codes-019', title: 'Exit Codes', tier: 'intermediate', topic: 'scripting readiness', minutes: 20 },
      { slug: 'linux-tar-020', title: 'Archive with tar', tier: 'intermediate', topic: 'backups', minutes: 30 }
    ]
  },
  {
    track: 'file-permissions',
    category: 'Linux Permissions',
    bundled: true,
    labs: [
      { slug: 'perm-view-002', title: 'Read Permission Bits', tier: 'beginner', topic: 'ls -l output', minutes: 20 },
      { slug: 'perm-chmod-symbolic-003', title: 'chmod Symbolic Mode', tier: 'beginner', topic: 'u/g/o permissions', minutes: 25 },
      { slug: 'perm-chmod-octal-004', title: 'chmod Octal Mode', tier: 'intermediate', topic: '755 and 644', minutes: 25 },
      { slug: 'perm-chown-005', title: 'Change File Owner', tier: 'intermediate', topic: 'chown basics', minutes: 25 },
      { slug: 'perm-chgrp-006', title: 'Change Group Ownership', tier: 'intermediate', topic: 'chgrp', minutes: 20 },
      { slug: 'perm-umask-007', title: 'Default Permissions with umask', tier: 'intermediate', topic: 'creation mask', minutes: 25 },
      { slug: 'perm-sticky-008', title: 'Sticky Bit on /tmp', tier: 'intermediate', topic: 'shared directories', minutes: 25 },
      { slug: 'perm-setgid-009', title: 'setgid on Directories', tier: 'advanced', topic: 'collaboration dirs', minutes: 30 },
      { slug: 'perm-acl-intro-010', title: 'ACL Basics', tier: 'advanced', topic: 'getfacl/setfacl', minutes: 35 },
      { slug: 'perm-sudoers-011', title: 'Least Privilege Editing', tier: 'advanced', topic: 'sudo for one command', minutes: 30 },
      { slug: 'perm-world-writable-012', title: 'Find World-Writable Files', tier: 'intermediate', topic: 'audit hygiene', minutes: 30 },
      { slug: 'perm-suid-awareness-013', title: 'SUID Awareness (read-only)', tier: 'advanced', topic: 'risk identification', minutes: 30 },
      { slug: 'perm-special-bits-014', title: 'Special Bits Summary', tier: 'advanced', topic: 'suid/sgid/sticky review', minutes: 25 },
      { slug: 'perm-repair-web-015', title: 'Repair Web Root Permissions', tier: 'intermediate', topic: 'nginx docroot', minutes: 35 }
    ]
  },
  {
    track: 'networking',
    category: 'Networking',
    bundled: true,
    labs: [
      { slug: 'net-ip-001', title: 'Inspect IP Addresses', tier: 'beginner', topic: 'ip addr', minutes: 20 },
      { slug: 'net-route-002', title: 'Default Gateway', tier: 'beginner', topic: 'ip route', minutes: 20 },
      { slug: 'net-ping-003', title: 'Reachability with ping', tier: 'beginner', topic: 'ICMP echo', minutes: 15 },
      { slug: 'net-dns-004', title: 'DNS Lookup', tier: 'beginner', topic: 'dig/host/nslookup', minutes: 20 },
      { slug: 'net-ss-005', title: 'Listening Ports with ss', tier: 'intermediate', topic: 'socket states', minutes: 25 },
      { slug: 'net-curl-006', title: 'HTTP Headers with curl', tier: 'beginner', topic: 'curl -I', minutes: 20 },
      { slug: 'net-wget-007', title: 'Download Artifacts', tier: 'beginner', topic: 'wget basics', minutes: 20 },
      { slug: 'net-traceroute-008', title: 'Path with traceroute', tier: 'intermediate', topic: 'hop inspection', minutes: 25 },
      { slug: 'net-arp-009', title: 'ARP Table Basics', tier: 'intermediate', topic: 'L2 neighbors', minutes: 25 },
      { slug: 'net-hosts-010', title: 'Static Hostname Mapping', tier: 'beginner', topic: '/etc/hosts', minutes: 20 },
      { slug: 'net-resolv-011', title: 'Resolver Configuration', tier: 'intermediate', topic: 'resolv.conf', minutes: 25 },
      { slug: 'net-firewall-intro-012', title: 'Firewall Rules Overview', tier: 'intermediate', topic: 'iptables/nft intro', minutes: 30 },
      { slug: 'net-nat-concepts-013', title: 'NAT Concepts', tier: 'intermediate', topic: 'SNAT/DNAT reading', minutes: 25 },
      { slug: 'net-vlan-concepts-014', title: 'VLAN Concepts (theory)', tier: 'advanced', topic: '802.1Q basics', minutes: 20 },
      { slug: 'net-capture-readonly-015', title: 'Read a tcpdump Capture', tier: 'advanced', topic: 'pcap analysis', minutes: 35 }
    ]
  },
  {
    track: 'docker',
    category: 'Containers',
    bundled: true,
    labs: [
      { slug: 'docker-images-003', title: 'List Local Images', tier: 'beginner', topic: 'docker images', minutes: 15 },
      { slug: 'docker-ps-004', title: 'Running Containers', tier: 'beginner', topic: 'docker ps', minutes: 15 },
      { slug: 'docker-logs-005', title: 'Container Logs', tier: 'beginner', topic: 'docker logs', minutes: 20 },
      { slug: 'docker-exec-006', title: 'Shell into a Container', tier: 'intermediate', topic: 'docker exec', minutes: 25 },
      { slug: 'docker-run-007', title: 'Run an Ephemeral Container', tier: 'intermediate', topic: 'docker run flags', minutes: 25 },
      { slug: 'docker-stop-rm-008', title: 'Stop and Remove', tier: 'beginner', topic: 'lifecycle', minutes: 20 },
      { slug: 'docker-inspect-009', title: 'Inspect Metadata', tier: 'intermediate', topic: 'docker inspect', minutes: 25 },
      { slug: 'docker-network-ls-010', title: 'Docker Networks', tier: 'intermediate', topic: 'bridge networks', minutes: 25 },
      { slug: 'docker-volume-ls-011', title: 'Docker Volumes', tier: 'intermediate', topic: 'persistent data', minutes: 25 },
      { slug: 'docker-compose-up-012', title: 'Compose Up', tier: 'intermediate', topic: 'multi-container', minutes: 30 },
      { slug: 'docker-compose-logs-013', title: 'Compose Logs', tier: 'intermediate', topic: 'service debugging', minutes: 25 },
      { slug: 'docker-build-014', title: 'Build from Dockerfile', tier: 'intermediate', topic: 'docker build', minutes: 35 },
      { slug: 'docker-tag-015', title: 'Tag an Image', tier: 'intermediate', topic: 'registry naming', minutes: 20 }
    ]
  },
  {
    track: 'web-server',
    category: 'Web Services',
    bundled: true,
    labs: [
      { slug: 'web-nginx-start-002', title: 'Start nginx', tier: 'beginner', topic: 'systemctl/nginx', minutes: 20 },
      { slug: 'web-vhost-003', title: 'Virtual Host Basics', tier: 'intermediate', topic: 'server_name', minutes: 30 },
      { slug: 'web-static-004', title: 'Serve Static Files', tier: 'beginner', topic: 'index.html', minutes: 25 },
      { slug: 'web-error-log-005', title: 'Read Error Logs', tier: 'intermediate', topic: 'log troubleshooting', minutes: 25 },
      { slug: 'web-access-log-006', title: 'Parse Access Logs', tier: 'intermediate', topic: 'combined log format', minutes: 30 },
      { slug: 'web-reverse-proxy-007', title: 'Reverse Proxy Intro', tier: 'intermediate', topic: 'proxy_pass', minutes: 35 },
      { slug: 'web-tls-concepts-008', title: 'TLS Termination Concepts', tier: 'advanced', topic: 'cert paths', minutes: 25 },
      { slug: 'web-apache-status-009', title: 'Apache Status Page', tier: 'intermediate', topic: 'mod_status', minutes: 30 },
      { slug: 'web-health-check-010', title: 'HTTP Health Checks', tier: 'beginner', topic: '/health endpoint', minutes: 20 }
    ]
  },
  {
    track: 'databases',
    category: 'Databases',
    bundled: true,
    labs: [
      { slug: 'db-sqlite-intro-001', title: 'SQLite Shell Basics', tier: 'beginner', topic: 'SELECT queries', minutes: 25 },
      { slug: 'db-mysql-connect-002', title: 'Connect to MySQL', tier: 'beginner', topic: 'mysql client', minutes: 25 },
      { slug: 'db-select-filter-003', title: 'Filter with WHERE', tier: 'beginner', topic: 'SQL filters', minutes: 20 },
      { slug: 'db-insert-004', title: 'Insert Training Rows', tier: 'intermediate', topic: 'INSERT', minutes: 25 },
      { slug: 'db-backup-005', title: 'Logical Backup', tier: 'intermediate', topic: 'mysqldump', minutes: 30 },
      { slug: 'db-restore-006', title: 'Restore from Dump', tier: 'intermediate', topic: 'import SQL', minutes: 30 },
      { slug: 'db-user-grants-007', title: 'User Grants (least privilege)', tier: 'advanced', topic: 'GRANT', minutes: 35 },
      { slug: 'db-index-basics-008', title: 'Index Awareness', tier: 'intermediate', topic: 'EXPLAIN intro', minutes: 30 },
      { slug: 'db-postgres-psql-009', title: 'psql Basics', tier: 'intermediate', topic: 'PostgreSQL client', minutes: 25 },
      { slug: 'db-redis-ping-010', title: 'Redis PING/PONG', tier: 'beginner', topic: 'key-value health', minutes: 20 }
    ]
  },
  {
    track: 'security-basics',
    category: 'Security Basics',
    bundled: true,
    labs: [
      { slug: 'sec-auth-logs-001', title: 'Review Auth Logs', tier: 'beginner', topic: 'failed logins', minutes: 25 },
      { slug: 'sec-ssh-hardening-002', title: 'SSH Config Review', tier: 'intermediate', topic: 'sshd_config', minutes: 30 },
      { slug: 'sec-password-policy-003', title: 'Password Policy Reading', tier: 'beginner', topic: 'login.defs', minutes: 20 },
      { slug: 'sec-fail2ban-concepts-004', title: 'fail2ban Concepts', tier: 'intermediate', topic: 'ban rules', minutes: 25 },
      { slug: 'sec-file-integrity-005', title: 'Find Changed Files', tier: 'intermediate', topic: 'checksum audit', minutes: 30 },
      { slug: 'sec-world-readable-006', title: 'Audit Sensitive Files', tier: 'intermediate', topic: 'permission sweep', minutes: 30 },
      { slug: 'sec-suid-find-007', title: 'Find SUID Binaries', tier: 'advanced', topic: 'risk inventory', minutes: 35 },
      { slug: 'sec-firewall-default-008', title: 'Default Deny Mindset', tier: 'intermediate', topic: 'ufw status', minutes: 25 },
      { slug: 'sec-update-packages-009', title: 'Patch Posture Check', tier: 'beginner', topic: 'apt list --upgradable', minutes: 20 },
      { slug: 'sec-apparmor-view-010', title: 'AppArmor Status (read-only)', tier: 'advanced', topic: 'aa-status', minutes: 25 }
    ]
  },
  {
    track: 'troubleshooting',
    category: 'Troubleshooting',
    bundled: true,
    labs: [
      { slug: 'ts-disk-full-001', title: 'Diagnose Disk Full', tier: 'intermediate', topic: 'df/du', minutes: 30 },
      { slug: 'ts-service-down-002', title: 'Service Will Not Start', tier: 'intermediate', topic: 'journalctl', minutes: 35 },
      { slug: 'ts-high-cpu-003', title: 'High CPU Investigation', tier: 'intermediate', topic: 'top/ps', minutes: 30 },
      { slug: 'ts-high-mem-004', title: 'Memory Pressure', tier: 'intermediate', topic: 'free/htop', minutes: 30 },
      { slug: 'ts-dns-failure-005', title: 'DNS Resolution Failure', tier: 'intermediate', topic: 'resolver debug', minutes: 30 },
      { slug: 'ts-port-conflict-006', title: 'Port Already in Use', tier: 'intermediate', topic: 'ss/lsof', minutes: 25 },
      { slug: 'ts-permission-denied-007', title: 'Permission Denied Errors', tier: 'beginner', topic: 'chmod/owner', minutes: 25 },
      { slug: 'ts-config-syntax-008', title: 'Fix Config Syntax', tier: 'intermediate', topic: 'nginx -t', minutes: 30 },
      { slug: 'ts-cron-silent-009', title: 'Cron Job Silent Failure', tier: 'intermediate', topic: 'MAILTO/logs', minutes: 30 },
      { slug: 'ts-cert-expiry-010', title: 'Certificate Expiry Check', tier: 'advanced', topic: 'openssl s_client', minutes: 30 }
    ]
  },
  {
    track: 'windows-concepts',
    category: 'Windows Administration',
    bundled: true,
    labs: [
      { slug: 'win-services-001', title: 'Windows Services Concepts', tier: 'beginner', topic: 'services.msc mapping', minutes: 20 },
      { slug: 'win-rdp-hardening-002', title: 'RDP Hardening Checklist', tier: 'intermediate', topic: 'NLA concepts', minutes: 25 },
      { slug: 'win-ad-readonly-003', title: 'Read AD Group Membership', tier: 'intermediate', topic: 'whoami /groups', minutes: 25 },
      { slug: 'win-powershell-help-004', title: 'PowerShell Get-Help', tier: 'beginner', topic: 'cmdlet discovery', minutes: 20 },
      { slug: 'win-eventlog-005', title: 'Event Viewer Patterns', tier: 'intermediate', topic: 'logon events', minutes: 30 }
    ]
  },
  {
    track: 'advanced-networking',
    category: 'Networking',
    bundled: false,
    labs: [
      { slug: 'comm-bgp-concepts-001', title: 'BGP Concepts Lab', tier: 'advanced', topic: 'path attributes', minutes: 40 },
      { slug: 'comm-ipsec-read-002', title: 'IPsec Policy Review', tier: 'advanced', topic: 'policy read-only', minutes: 35 },
      { slug: 'comm-wireshark-filters-003', title: 'Wireshark Display Filters', tier: 'advanced', topic: 'capture analysis', minutes: 40 },
      { slug: 'comm-ipv6-neigh-004', title: 'IPv6 Neighbor Table', tier: 'advanced', topic: 'ndisc', minutes: 30 },
      { slug: 'comm-lb-health-005', title: 'Load Balancer Health', tier: 'advanced', topic: 'backend probes', minutes: 35 }
    ]
  },
  {
    track: 'advanced-security',
    category: 'Security Basics',
    bundled: false,
    labs: [
      { slug: 'comm-log-forensics-001', title: 'Log Timeline Correlation', tier: 'advanced', topic: 'incident triage', minutes: 45 },
      { slug: 'comm-hardening-bench-002', title: 'CIS Benchmark Reading', tier: 'advanced', topic: 'control mapping', minutes: 40 },
      { slug: 'comm-secrets-scan-003', title: 'Find Secrets in Configs', tier: 'advanced', topic: 'grep patterns', minutes: 35 },
      { slug: 'comm-container-scan-004', title: 'Container Image Labels', tier: 'advanced', topic: 'supply chain', minutes: 30 },
      { slug: 'comm-waf-logs-005', title: 'WAF Log Review', tier: 'advanced', topic: 'blocked requests', minutes: 40 }
    ]
  },
  {
    track: 'advanced-docker',
    category: 'Containers',
    bundled: false,
    labs: [
      { slug: 'comm-compose-override-001', title: 'Compose Overrides', tier: 'advanced', topic: 'dev/prod profiles', minutes: 35 },
      { slug: 'comm-dockerfile-lint-002', title: 'Dockerfile Best Practices', tier: 'advanced', topic: 'layer hygiene', minutes: 30 },
      { slug: 'comm-registry-mirror-003', title: 'Registry Mirror Concepts', tier: 'advanced', topic: 'pull policy', minutes: 25 },
      { slug: 'comm-cgroup-limits-004', title: 'Container Resource Limits', tier: 'advanced', topic: 'cpus/mem', minutes: 35 },
      { slug: 'comm-healthcheck-005', title: 'HEALTHCHECK Directive', tier: 'intermediate', topic: 'Dockerfile health', minutes: 30 }
    ]
  },
  {
    track: 'advanced-databases',
    category: 'Databases',
    bundled: false,
    labs: [
      { slug: 'comm-replication-lag-001', title: 'Replication Lag Signals', tier: 'advanced', topic: 'read replica', minutes: 40 },
      { slug: 'comm-slow-query-002', title: 'Slow Query Log', tier: 'advanced', topic: 'performance', minutes: 40 },
      { slug: 'comm-pg-vacuum-003', title: 'PostgreSQL Vacuum Concepts', tier: 'advanced', topic: 'bloat', minutes: 35 },
      { slug: 'comm-redis-persistence-004', title: 'Redis RDB/AOF Concepts', tier: 'advanced', topic: 'durability', minutes: 30 },
      { slug: 'comm-backup-encrypt-005', title: 'Encrypted Backup Concepts', tier: 'advanced', topic: 'at-rest', minutes: 35 }
    ]
  },
  {
    track: 'advanced-troubleshooting',
    category: 'Troubleshooting',
    bundled: false,
    labs: [
      { slug: 'comm-intermittent-net-001', title: 'Intermittent Network Loss', tier: 'advanced', topic: 'mtu/mss', minutes: 45 },
      { slug: 'comm-io-wait-002', title: 'IO Wait Investigation', tier: 'advanced', topic: 'iostat', minutes: 40 },
      { slug: 'comm-systemd-deps-003', title: 'systemd Dependency Cycle', tier: 'advanced', topic: 'systemctl list-dependencies', minutes: 40 },
      { slug: 'comm-kernel-ring-004', title: 'Kernel Ring Buffer', tier: 'advanced', topic: 'dmesg', minutes: 35 },
      { slug: 'comm-postmortem-005', title: 'Write a Mini Postmortem', tier: 'advanced', topic: 'documentation', minutes: 45 }
    ]
  }
]

function markerPath(id) {
  return `/tmp/${id}-complete`
}

function buildLabJson(spec, track, category, bundled, labIndex, sectionLabs) {
  const difficulty = DIFFICULTY[spec.tier]
  const marker = markerPath(spec.slug)
  const readMarker = `/tmp/${spec.slug}-read`
  return {
    id: spec.slug,
    title: spec.title,
    difficulty,
    category,
    bundled,
    estimatedTimeMinutes: spec.minutes,
    description: `Practice ${spec.topic} in an isolated Docker training environment. Complete the briefing tasks and create the completion marker.`,
    labMode: 'target-only',
    runtime: 'docker',
    docker: {
      image: `sysadmin-game/${spec.slug}:latest`,
      buildPath: '..',
      ports: []
    },
    tags: [track.replace(/-/g, ' '), spec.topic.split(' ')[0].toLowerCase(), bundled ? 'bundled' : 'community'],
    safetyNotes: [
      'Commands run only inside the lab container — not on your host.',
      'Do not paste destructive commands (rm -rf /, mkfs, dd to disks) even inside the lab.'
    ],
    tasks: [
      'Open the lab terminal (session user is already logged in)',
      `Read the briefing in ~/README.txt about ${spec.topic}`,
      `Create the read marker: touch ${readMarker}`,
      `Create the completion marker: touch ${marker}`,
      'Use Check in the lab panel — the lab completes when objectives pass'
    ],
    objectivesPublic: [
      {
        id: 'read-briefing',
        label: 'Read the briefing',
        text: 'Read ~/README.txt and mark it read.',
        hint: `Run: touch ${readMarker}`
      },
      {
        id: 'complete-lab',
        label: 'Finish the exercise',
        text: `Apply what you learned about ${spec.topic} and create the completion marker.`,
        hint: `Run: touch ${marker}`
      }
    ],
    objectives: [
      { id: 'read-briefing', autoCheck: 'fileExists', path: readMarker },
      { id: 'complete-lab', autoCheck: 'fileExists', path: marker }
    ],
    hints: [
      `Focus on ${spec.topic}.`,
      'Use ls, cat, and touch — no root privileges required.',
      `Completion marker path: ${marker}`
    ],
    successCriteria: [
      `Briefing read marker exists at ${readMarker}`,
      `Completion marker exists at ${marker}`
    ],
    validation: { type: 'fileExists', path: marker },
    postLabReview: {
      summary: `You practiced ${spec.topic} in a safe container.`,
      skillsPracticed: [
        `${spec.title} reinforces everyday sysadmin skills.`,
        'Verify files with ls -l after creating markers.',
        'Repeat the lab to build muscle memory.'
      ]
    },
    xpReward: xpRewardFor(spec),
    unlockRequirements: buildUnlockRequirements(track, spec.tier, labIndex, sectionLabs, bundled)
  }
}

function dockerfileContent(relativePosix) {
  return `FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-ssh-login-fix

RUN apt-get update \\
  && apt-get install -y --no-install-recommends openssh-server ca-certificates \\
  && rm -rf /var/lib/apt/lists/* \\
  && mkdir -p /run/sshd /var/run/sshd

COPY common/apply-lab-credentials.sh /usr/local/bin/apply-lab-credentials.sh
COPY common/configure-lab-ssh-access.sh /usr/local/bin/configure-lab-ssh-access.sh
COPY common/start-lab-sshd.sh /usr/local/bin/start-lab-sshd.sh
COPY common/sgq-entrypoint.sh /usr/local/bin/sgq-entrypoint.sh
COPY ${relativePosix}/lab-setup.sh /usr/local/bin/lab-setup.sh

RUN sed -i 's/\\r$//' /usr/local/bin/apply-lab-credentials.sh /usr/local/bin/configure-lab-ssh-access.sh /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh \\
  && chmod +x /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh

LABEL sgq.lab.entrypoint.version="\${SGQ_LAB_ENTRYPOINT_VERSION}"

ENTRYPOINT ["/usr/local/bin/sgq-entrypoint.sh"]
`
}

function labSetupContent(spec) {
  const marker = markerPath(spec.slug)
  const readMarker = `/tmp/${spec.slug}-read`
  return `#!/bin/bash
set -euo pipefail

u="\${SGQ_USERNAME:-\${LAB_USERNAME:-student}}"
home="/home/$u"
mkdir -p "$home"
cat >"$home/README.txt" <<'EOF'
Mission: ${spec.title}
Topic: ${spec.topic}
---------------------
1. Explore the topic: ${spec.topic}
2. Mark briefing read: touch ${readMarker}
3. Create completion marker: touch ${marker}

All work stays inside this training container.
EOF
chown "$u:$u" "$home/README.txt" 2>/dev/null || true
rm -f ${readMarker} ${marker}
`
}

function readmeContent(spec, category, bundled) {
  return `# ${spec.title}

**Category:** ${category}  
**Difficulty:** ${DIFFICULTY[spec.tier]}  
**Type:** ${bundled ? 'Bundled (ships with app)' : 'Community example'}  
**Estimated time:** ${spec.minutes} minutes

## Overview

Practice **${spec.topic}** inside an isolated Docker lab target. No host access required.

## Objectives

1. Read \`~/README.txt\`
2. Create the read and completion markers described in the briefing
3. Run **Check** in the app

## Safety

- Educational use only
- Do not run destructive commands
- Container is ephemeral and offline-capable once built

## Files

- \`lab.json\` — lab definition
- \`lab-setup.sh\` — container bootstrap (bundled labs)
- \`Dockerfile\` — image build (bundled labs)
`
}

function writeLab(baseDir, relativePosix, spec, track, category, bundled, labIndex, sectionLabs) {
  fs.mkdirSync(baseDir, { recursive: true })
  const labJson = buildLabJson(spec, track, category, bundled, labIndex, sectionLabs)
  fs.writeFileSync(path.join(baseDir, 'lab.json'), `${JSON.stringify(labJson, null, 2)}\n`)
  fs.writeFileSync(path.join(baseDir, 'README.md'), readmeContent(spec, category, bundled))
  fs.writeFileSync(path.join(baseDir, 'Dockerfile'), dockerfileContent(relativePosix))
  fs.writeFileSync(path.join(baseDir, 'lab-setup.sh'), labSetupContent(spec))
}

/** Add Dockerfile + lab-setup.sh to existing community labs that only have definitions. */
function ensureCommunityDockerAssets() {
  let patched = 0
  for (const section of CURRICULUM) {
    if (section.bundled) continue
    for (const spec of section.labs) {
      const baseDir = path.join(LABS_ROOT, 'community', 'examples', section.track, spec.slug)
      const labJsonPath = path.join(baseDir, 'lab.json')
      if (!fs.existsSync(labJsonPath)) continue
      const relativePosix = `community/examples/${section.track}/${spec.slug}`.replace(/\\/g, '/')
      const dockerPath = path.join(baseDir, 'Dockerfile')
      const setupPath = path.join(baseDir, 'lab-setup.sh')
      if (fs.existsSync(dockerPath) && fs.existsSync(setupPath)) continue
      fs.writeFileSync(dockerPath, dockerfileContent(relativePosix))
      fs.writeFileSync(setupPath, labSetupContent(spec))
      patched += 1
      console.log('added docker assets', relativePosix)
    }
  }
  return patched
}

/** Patch unlockRequirements + xpReward on existing catalog labs from CURRICULUM. */
function patchLabProgression() {
  let patched = 0
  for (const section of CURRICULUM) {
    section.labs.forEach((spec, labIndex) => {
      const rootSegment = section.bundled ? 'bundled' : path.join('community', 'examples')
      const labJsonPath = path.join(LABS_ROOT, rootSegment, section.track, spec.slug, 'lab.json')
      if (!fs.existsSync(labJsonPath)) return
      const data = JSON.parse(fs.readFileSync(labJsonPath, 'utf8'))
      const difficulty = DIFFICULTY[spec.tier]
      data.unlockRequirements = buildUnlockRequirements(
        section.track,
        spec.tier,
        labIndex,
        section.labs,
        section.bundled
      )
      data.xpReward = xpRewardFor(spec)
      data.difficulty = difficulty
      fs.writeFileSync(labJsonPath, `${JSON.stringify(data, null, 2)}\n`)
      patched += 1
    })
  }
  return patched
}

const dockerOnly = process.argv.includes('--docker-only')
const progressionOnly = process.argv.includes('--progression-only')

if (progressionOnly) {
  const patched = patchLabProgression()
  console.log(`Patched progression on ${patched} lab(s)`)
} else if (dockerOnly) {
  const patched = ensureCommunityDockerAssets()
  console.log(`Added Docker assets to ${patched} community lab(s)`)
} else {
for (const section of CURRICULUM) {
  const rootSegment = section.bundled ? 'bundled' : path.join('community', 'examples')
  for (const spec of section.labs) {
    const baseDir = path.join(LABS_ROOT, rootSegment, section.track, spec.slug)
    const relativePosix = `${rootSegment}/${section.track}/${spec.slug}`.replace(/\\/g, '/')
    const labIndex = section.labs.indexOf(spec)
    if (fs.existsSync(path.join(baseDir, 'lab.json'))) {
      console.log('skip existing', relativePosix)
      continue
    }
    writeLab(baseDir, relativePosix, spec, section.track, section.category, section.bundled, labIndex, section.labs)
    created += 1
  }
}

console.log(`Generated ${created} new lab pack(s) under ${LABS_ROOT}`)
  const patched = ensureCommunityDockerAssets()
  if (patched > 0) {
    console.log(`Ensured Docker assets on ${patched} existing community lab(s)`)
  }
}
