/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {'cmd' | 'out' | 'success' | 'warning' | 'error' | 'log'} FakeLineType */

/** @typedef {{ type: FakeLineType, text: string }} FakeTerminalLine */

const PREFIXES = ['alpha', 'beta', 'gamma', 'delta', 'nova', 'apex', 'orbit', 'pulse', 'vector', 'cipher']
const ROLES = ['node', 'worker', 'router', 'relay', 'beacon', 'hub', 'core', 'edge', 'vault', 'proxy']
const CLUSTERS = ['atlas', 'horizon', 'meridian', 'spectre', 'citadel', 'ember', 'lattice', 'nimbus', 'forge', 'vertex', 'quasar']
const LAB_ENVS = ['sandbox', 'training', 'staging', 'drill', 'sim', 'ops', 'mesh', 'grid']
const SERVICES = ['nginx', 'sshd', 'postgresql', 'redis', 'docker', 'kubelet', 'vault-agent', 'haproxy']
const DOMAINS = ['lab.local', 'train.internal', 'ops.sim', 'grid.lab', 'nexus.training']
const K8S_NS = ['default', 'kube-system', 'training', 'labs', 'monitoring']

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(list) {
  return list[randInt(0, list.length - 1)]
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

export function fakeHostname() {
  return `${pick(PREFIXES)}-${pick(ROLES)}-${pad2(randInt(1, 99))}`
}

export function fakeContainerName() {
  return `${pick(LAB_ENVS)}-${pick(PREFIXES)}-${pick(ROLES)}-${pad2(randInt(1, 40))}`
}

export function fakePodName() {
  return `${pick(SERVICES)}-${pick(PREFIXES)}-${randInt(1000, 9999)}`
}

export function fakeClusterName() {
  return `${pick(CLUSTERS)}-${pick(LAB_ENVS)}`
}

export function fakeDomain() {
  return `${pick(PREFIXES)}.${pick(DOMAINS)}`
}

export function fakeIpv4() {
  return `10.${randInt(10, 250)}.${randInt(0, 255)}.${randInt(1, 254)}`
}

export function fakePort() {
  return pick([22, 80, 443, 2222, 3000, 5432, 6379, 8080, 8443, 9200])
}

export function fakeDuration() {
  const units = ['secs', 'mins', 'hrs']
  const u = pick(units)
  const n = u === 'secs' ? randInt(4, 59) : randInt(1, 48)
  return `${n} ${u}`
}

/**
 * @returns {{ command: string, lines: FakeTerminalLine[] }}
 */
export function generateFakeScenario() {
  const generators = [
    genDockerPs,
    genSystemctlStatus,
    genKubectlPods,
    genSsh,
    genTailLog,
    genPing,
    genIpAddr,
    genNetstat,
    genJournalctl,
    genAnsible,
    genLabLog
  ]
  return pick(generators)()
}

function genDockerPs() {
  const rows = randInt(2, 4)
  const header = 'NAME                STATUS         PORTS'
  const body = []
  for (let i = 0; i < rows; i += 1) {
    const name = fakeContainerName().slice(0, 18).padEnd(18)
    const status = `${pick(['Up', 'Up', 'Restarting'])} ${fakeDuration()}`
    const hostPort = randInt(2200, 2299)
    const containerPort = pick([22, 80, 443, 3306])
    const ports = `0.0.0.0:${hostPort}->${containerPort}/tcp`
    body.push(`${name}  ${status.padEnd(14)}  ${ports}`)
  }
  return {
    command: 'docker ps',
    lines: [
      { type: 'out', text: header },
      ...body.map((text) => ({ type: 'success', text }))
    ]
  }
}

function genSystemctlStatus() {
  const svc = pick(SERVICES)
  const active = Math.random() > 0.2
  return {
    command: `systemctl status ${svc}`,
    lines: active
      ? [
          { type: 'success', text: `● ${svc}.service - Simulated ${svc} daemon` },
          { type: 'out', text: `   Loaded: loaded (/lib/systemd/system/${svc}.service; enabled)` },
          { type: 'success', text: `   Active: active (running) since ${pick(['Mon', 'Tue', 'Wed'])} 2026-0${randInt(1, 9)}-${pad2(randInt(1, 28))} ${pad2(randInt(0, 23))}:${pad2(randInt(0, 59))}:00 UTC` },
          { type: 'log', text: `   Main PID: ${randInt(1000, 65000)} (${svc})` }
        ]
      : [
          { type: 'warning', text: `● ${svc}.service - Simulated ${svc} daemon` },
          { type: 'error', text: '   Active: failed (Result: exit-code)' },
          { type: 'warning', text: '   Hint: run journalctl -xe for simulated trace output.' }
        ]
  }
}

function genKubectlPods() {
  const ns = pick(K8S_NS)
  const count = randInt(2, 5)
  const header = 'NAME                          READY   STATUS    RESTARTS   AGE'
  const rows = []
  for (let i = 0; i < count; i += 1) {
    const name = fakePodName().padEnd(28)
    const ready = `${randInt(0, 1)}/1`
    const status = pick(['Running', 'Running', 'Pending', 'CrashLoopBackOff'])
    const restarts = randInt(0, 4)
    const age = `${randInt(1, 120)}m`
    rows.push(`${name}  ${ready}     ${status.padEnd(9)}  ${restarts}          ${age}`)
  }
  return {
    command: `kubectl get pods -n ${ns}`,
    lines: [{ type: 'out', text: header }, ...rows.map((text) => ({ type: 'success', text }))]
  }
}

function genSsh() {
  const host = fakeHostname()
  const domain = fakeDomain()
  return {
    command: `ssh admin@${host}.${domain}`,
    lines: [
      { type: 'log', text: `Connecting to ${host}.${domain} ${fakeIpv4()} port 22...` },
      { type: 'success', text: 'Authenticated to training bastion (simulated).' },
      { type: 'out', text: `Welcome to ${pick(LAB_ENVS)} environment on ${fakeClusterName()}-cluster.` }
    ]
  }
}

function genTailLog() {
  const file = pick(['/var/log/syslog', '/var/log/nginx/access.log', '/var/log/auth.log'])
  const lines = []
  for (let i = 0; i < randInt(2, 4); i += 1) {
    const level = pick(['INFO', 'INFO', 'WARN', 'ERROR'])
    const type = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warning' : 'log'
    lines.push({
      type,
      text: `${new Date().toISOString().slice(11, 19)} ${level}  ${pick(SERVICES)}[${randInt(1000, 9999)}]: synthetic event #${randInt(100, 999)}`
    })
  }
  return { command: `tail -f ${file}`, lines }
}

function genPing() {
  const target = fakeDomain()
  const ms = (Math.random() * 2 + 0.1).toFixed(2)
  const seq = randInt(1, 8)
  return {
    command: `ping -c 3 ${target}`,
    lines: [
      { type: 'out', text: `PING ${target} (${fakeIpv4()}) 56(84) bytes of data.` },
      { type: 'success', text: `64 bytes from ${target}: icmp_seq=${seq} ttl=64 time=${ms} ms` },
      { type: 'log', text: `--- ${target} ping statistics ---` },
      { type: 'success', text: '3 packets transmitted, 3 received, 0% packet loss' }
    ]
  }
}

function genIpAddr() {
  const iface = pick(['eth0', 'ens160', 'lab0', 'veth0'])
  const ip = fakeIpv4()
  return {
    command: 'ip addr',
    lines: [
      { type: 'out', text: `3: ${iface}: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500` },
      { type: 'success', text: `    inet ${ip}/24 brd ${ip.replace(/\d+$/, '255')} scope global ${iface}` },
      { type: 'log', text: `    link/ether 02:42:${randInt(10, 99)}:${randInt(10, 99)}:${randInt(10, 99)}:${randInt(10, 99)}` }
    ]
  }
}

function genNetstat() {
  const rows = randInt(2, 4)
  const lines = [{ type: 'out', text: 'Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name' }]
  for (let i = 0; i < rows; i += 1) {
    const port = fakePort()
    lines.push({
      type: 'success',
      text: `tcp        0      0 0.0.0.0:${port}            0.0.0.0:*               LISTEN      ${randInt(1000, 32000)}/${pick(SERVICES)}`
    })
  }
  return { command: 'netstat -tulpn', lines }
}

function genJournalctl() {
  const unit = pick(SERVICES)
  const lines = []
  for (let i = 0; i < randInt(2, 3); i += 1) {
    const isErr = Math.random() < 0.25
    lines.push({
      type: isErr ? 'error' : 'log',
      text: `${pick(['Feb', 'Mar', 'Apr'])} ${pad2(randInt(1, 28))} ${pad2(randInt(0, 23))}:${pad2(randInt(0, 59))}:00 ${fakeHostname()} ${unit}[${randInt(1000, 8000)}]: ${pick(['started', 'stopped', 'reload', 'config check'])} (simulated)`
    })
  }
  return { command: `journalctl -u ${unit} -n 20`, lines }
}

function genAnsible() {
  const play = pick(['deploy.yml', 'hardening.yml', 'lab-provision.yml'])
  const host = fakeHostname()
  return {
    command: `ansible-playbook ${play}`,
    lines: [
      { type: 'out', text: `PLAY [${pick(LAB_ENVS)} training batch] ****************************************` },
      { type: 'success', text: `TASK [Gathering Facts] *********************************************************` },
      { type: 'success', text: `ok: [${host}]` },
      { type: 'log', text: `PLAY RECAP *********************************************************************` },
      { type: 'success', text: `${host}             : ok=${randInt(3, 12)}   changed=${randInt(0, 4)}   unreachable=0    failed=0` }
    ]
  }
}

function genLabLog() {
  return {
    command: pick(['labctl status', 'labctl scan', 'trainops ping']),
    lines: [
      {
        type: 'log',
        text: `[lab] cluster=${fakeClusterName()} env=${pick(LAB_ENVS)} node=${fakeHostname()}`
      },
      {
        type: Math.random() < 0.3 ? 'warning' : 'success',
        text: pick([
          'Synthetic health check passed (visualization only).',
          'Training mesh synchronized — no live systems contacted.',
          'Scenario cache warmed with fictional telemetry.'
        ])
      }
    ]
  }
}

/** @param {number} min @param {number} max */
export function randomDelay(min, max) {
  return randInt(min, max)
}

/** @param {number} min @param {number} max */
export function randomTypingSpeed(min, max) {
  return randInt(min, max)
}
