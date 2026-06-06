/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Safety policy: never suggest destructive host commands.
 * Commands here are intended for lab containers and local troubleshooting basics.
 */

export const COMMAND_CATEGORIES = [
  'navigation',
  'files',
  'permissions',
  'users-groups',
  'services',
  'logs',
  'networking',
  'ssh',
  'docker',
  'web-servers',
  'disk',
  'processes',
  'windows-powershell',
  'vm-basics'
]

/** @type {('none'|'caution'|'risky'|'blocked')} */
export const WARNING_LEVELS = {
  none: 'none',
  caution: 'caution',
  risky: 'risky',
  blocked: 'blocked'
}

/**
 * @typedef {{
 *  key: string
 *  command: string
 *  explanation: string
 *  example: string
 *  difficulty: 'Easy'|'Medium'|'Hard'
 *  category: string
 *  warningLevel?: 'none'|'caution'|'risky'|'blocked'
 *  mayHelp?: boolean
 * }} CommandEntry
 */

/** Extremely dangerous command patterns (don’t show by default). */
export const BLOCKED_PATTERNS = [
  /\brm\s+-rf\s+\/\b/i,
  /\bdd\b/i,
  /\bmkfs\b/i,
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\breg\s+delete\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i
]

/** @param {string} cmd */
export function isBlockedCommand(cmd) {
  const s = String(cmd || '')
  return BLOCKED_PATTERNS.some((re) => re.test(s))
}

/** @type {CommandEntry[]} */
export const COMMAND_CATALOG = [
  // Navigation
  {
    key: 'pwd',
    command: 'pwd',
    explanation: 'Print working directory (where you are).',
    example: 'pwd',
    difficulty: 'Easy',
    category: 'navigation',
    mayHelp: true
  },
  {
    key: 'ls',
    command: 'ls',
    explanation: 'List files in the current directory.',
    example: 'ls',
    difficulty: 'Easy',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'ls-la',
    command: 'ls -la',
    explanation: 'List files including hidden files and permissions.',
    example: 'ls -la ~',
    difficulty: 'Easy',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'ls-l',
    command: 'ls -l',
    explanation: 'Long listing — shows permissions, owner, size, and name.',
    example: 'ls -l /var/www/config/app.conf',
    difficulty: 'Easy',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'cd',
    command: 'cd <path>',
    explanation: 'Change directory.',
    example: 'cd /var/log',
    difficulty: 'Easy',
    category: 'navigation',
    mayHelp: true
  },
  // Files & text
  {
    key: 'cat',
    command: 'cat <file>',
    explanation: 'Print file contents (small files).',
    example: 'cat ~/readme.txt',
    difficulty: 'Easy',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'less',
    command: 'less <file>',
    explanation: 'View file contents with paging/search.',
    example: 'less /var/log/syslog',
    difficulty: 'Easy',
    category: 'logs',
    mayHelp: true
  },
  {
    key: 'grep',
    command: 'grep -R "text" <path>',
    explanation: 'Search for text inside files.',
    example: 'grep -R "error" /etc',
    difficulty: 'Medium',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'find',
    command: 'find <path> -name "pattern"',
    explanation: 'Find files by name/pattern.',
    example: 'find ~ /opt /var/tmp -name ".*flag*" 2>/dev/null',
    difficulty: 'Medium',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'head',
    command: 'head <file>',
    explanation: 'Show the first lines of a file.',
    example: 'head /var/log/syslog',
    difficulty: 'Easy',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'tail',
    command: 'tail <file>',
    explanation: 'Show the last lines of a file (useful for logs).',
    example: 'tail -n 50 /var/log/syslog',
    difficulty: 'Easy',
    category: 'logs',
    mayHelp: true
  },
  {
    key: 'touch',
    command: 'touch <file>',
    explanation: 'Create an empty file or update its timestamp.',
    example: 'touch /tmp/lab-complete',
    difficulty: 'Easy',
    category: 'files',
    mayHelp: true
  },
  {
    key: 'nano',
    command: 'nano <file>',
    explanation: 'Edit a text file in a simple terminal editor.',
    example: 'sudo nano /etc/nginx/sites-available/training.conf',
    difficulty: 'Medium',
    category: 'files',
    warningLevel: 'caution',
    mayHelp: true
  },
  {
    key: 'stat',
    command: 'stat -c "%a %n" <file>',
    explanation: 'Show numeric permission mode and filename.',
    example: 'stat -c "%a %n" /var/www/config/app.conf',
    difficulty: 'Medium',
    category: 'permissions',
    mayHelp: true
  },
  {
    key: 'mark-lab-complete',
    command: 'mark-lab-complete',
    explanation: 'Create the training completion marker (/tmp/lab-complete) when all objectives are done.',
    example: 'mark-lab-complete',
    difficulty: 'Easy',
    category: 'files',
    mayHelp: true
  },
  // Permissions
  {
    key: 'chmod',
    command: 'chmod <mode> <file>',
    explanation: 'Change file permissions.',
    example: 'chmod 644 /etc/nginx/nginx.conf',
    difficulty: 'Medium',
    category: 'permissions',
    warningLevel: 'caution',
    mayHelp: true
  },
  {
    key: 'chown',
    command: 'chown <user>:<group> <file>',
    explanation: 'Change file owner/group.',
    example: 'chown $USER:$USER ~/.hidden_flag',
    difficulty: 'Medium',
    category: 'permissions',
    warningLevel: 'caution',
    mayHelp: true
  },
  // Users/groups
  {
    key: 'whoami',
    command: 'whoami',
    explanation: 'Show current user.',
    example: 'whoami',
    difficulty: 'Easy',
    category: 'users-groups',
    mayHelp: true
  },
  {
    key: 'sudo',
    command: 'sudo <command>',
    explanation: 'Run a command as root (needed for services and system files).',
    example: 'sudo systemctl start nginx',
    difficulty: 'Medium',
    category: 'users-groups',
    warningLevel: 'caution',
    mayHelp: true
  },
  // Services/logs
  {
    key: 'systemctl-status',
    command: 'systemctl status <service>',
    explanation: 'Check service status (systemd).',
    example: 'systemctl status training-agent.service',
    difficulty: 'Medium',
    category: 'services',
    mayHelp: true
  },
  {
    key: 'systemctl-start',
    command: 'systemctl start <service>',
    explanation: 'Start a systemd service.',
    example: 'sudo systemctl start nginx',
    difficulty: 'Medium',
    category: 'services',
    warningLevel: 'caution',
    mayHelp: true
  },
  {
    key: 'systemctl-restart',
    command: 'systemctl restart <service>',
    explanation: 'Restart a systemd service after config changes.',
    example: 'sudo systemctl restart nginx',
    difficulty: 'Medium',
    category: 'services',
    warningLevel: 'caution',
    mayHelp: true
  },
  {
    key: 'systemctl-daemon-reload',
    command: 'systemctl daemon-reload',
    explanation: 'Reload systemd unit files after editing a .service file.',
    example: 'sudo systemctl daemon-reload',
    difficulty: 'Medium',
    category: 'services',
    warningLevel: 'caution',
    mayHelp: true
  },
  {
    key: 'journalctl-u',
    command: 'journalctl -u <service>',
    explanation: 'View logs for a specific systemd unit.',
    example: 'journalctl -u training-agent.service',
    difficulty: 'Medium',
    category: 'logs',
    mayHelp: true
  },
  {
    key: 'journalctl-xe',
    command: 'journalctl -xe',
    explanation: 'View recent systemd journal errors.',
    example: 'journalctl -xe',
    difficulty: 'Hard',
    category: 'logs',
    mayHelp: true
  },
  // Networking
  {
    key: 'ip-addr',
    command: 'ip addr',
    explanation: 'Show network interfaces and addresses.',
    example: 'ip addr',
    difficulty: 'Medium',
    category: 'networking',
    mayHelp: true
  },
  {
    key: 'ss-tulpn',
    command: 'ss -tulpn',
    explanation: 'List listening ports and processes.',
    example: 'ss -tulpn',
    difficulty: 'Hard',
    category: 'networking',
    mayHelp: true
  },
  {
    key: 'ping',
    command: 'ping -c 1 <host>',
    explanation: 'Test basic network reachability (ICMP).',
    example: 'ping -c 1 lab-target',
    difficulty: 'Easy',
    category: 'networking',
    mayHelp: true
  },
  // SSH
  {
    key: 'ssh',
    command: 'ssh <user>@<host>',
    explanation: 'Open an SSH session to a host.',
    example: 'ssh $USER@lab-target',
    difficulty: 'Easy',
    category: 'ssh',
    mayHelp: true
  },
  {
    key: 'scp',
    command: 'scp <src> <dest>',
    explanation: 'Copy files over SSH.',
    example: 'scp $USER@lab-target:/var/log/syslog .',
    difficulty: 'Medium',
    category: 'ssh',
    mayHelp: true
  },
  // Docker basics (host-side)
  {
    key: 'docker-ps',
    command: 'docker ps',
    explanation: 'List running containers (host).',
    example: 'docker ps',
    difficulty: 'Easy',
    category: 'docker',
    warningLevel: 'caution',
    mayHelp: true
  },
  // Disk/process
  {
    key: 'df-h',
    command: 'df -h',
    explanation: 'Show disk usage for mounted filesystems.',
    example: 'df -h /var/log/staging',
    difficulty: 'Easy',
    category: 'disk',
    mayHelp: true
  },
  {
    key: 'du-sh',
    command: 'du -sh <path>',
    explanation: 'Show approximate size of a file or directory.',
    example: 'du -sh /var/log/staging/*',
    difficulty: 'Medium',
    category: 'disk',
    mayHelp: true
  },
  {
    key: 'rm',
    command: 'rm <file>',
    explanation: 'Delete a file (training labs only — verify path first).',
    example: 'rm /var/log/staging/large.log',
    difficulty: 'Medium',
    category: 'disk',
    warningLevel: 'caution',
    mayHelp: true
  },
  {
    key: 'ps-aux',
    command: 'ps aux',
    explanation: 'List running processes.',
    example: 'ps aux | grep ssh',
    difficulty: 'Medium',
    category: 'processes',
    mayHelp: true
  },
  // Web servers
  {
    key: 'curl',
    command: 'curl -i http://127.0.0.1/',
    explanation: 'Make an HTTP request (useful for web labs).',
    example: 'curl -i http://127.0.0.1/',
    difficulty: 'Medium',
    category: 'web-servers',
    mayHelp: true
  },
  {
    key: 'nginx-t',
    command: 'nginx -t',
    explanation: 'Test NGINX configuration syntax without starting the server.',
    example: 'sudo nginx -t',
    difficulty: 'Medium',
    category: 'web-servers',
    mayHelp: true
  },
  // Windows / PowerShell basics
  {
    key: 'pwsh-get-content',
    command: 'Get-Content <path>',
    explanation: 'Read a file in PowerShell.',
    example: 'Get-Content .\\notes.txt',
    difficulty: 'Easy',
    category: 'windows-powershell',
    mayHelp: true
  },
  {
    key: 'pwsh-get-service',
    command: 'Get-Service',
    explanation: 'List services in PowerShell.',
    example: 'Get-Service | Select-Object -First 10',
    difficulty: 'Easy',
    category: 'windows-powershell',
    mayHelp: true
  },
  {
    key: 'pwsh-test-net',
    command: 'Test-NetConnection <host> -Port <port>',
    explanation: 'Test TCP connectivity in PowerShell.',
    example: 'Test-NetConnection 127.0.0.1 -Port 2222',
    difficulty: 'Easy',
    category: 'windows-powershell',
    mayHelp: true
  }
]

/** @param {string} s */
export function normalizeCommandKey(s) {
  return String(s || '').trim().toLowerCase()
}

/** @param {string} keyOrCommand */
export function findCatalogEntry(keyOrCommand) {
  const needle = normalizeCommandKey(keyOrCommand)
  if (!needle) return null
  return (
    COMMAND_CATALOG.find((e) => e.key === needle) ??
    COMMAND_CATALOG.find((e) => normalizeCommandKey(e.command) === needle) ??
    COMMAND_CATALOG.find((e) => normalizeCommandKey(e.command).startsWith(needle))
  )
}

