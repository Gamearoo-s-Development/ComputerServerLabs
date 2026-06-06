/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { runCommand } from './utils/exec.js'
import { logger } from './utils/logger.js'

const DETECTION_TIMEOUT_MS = 8000

const WINDOWS_VBOX_MANAGE_PATHS = [
  'C:\\Program Files\\Oracle\\VirtualBox\\VBoxManage.exe',
  'C:\\Program Files (x86)\\Oracle\\VirtualBox\\VBoxManage.exe'
]

const WINDOWS_DOCKER_BIN_PATHS = [
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe'
]

const VBOX_REGISTRY_KEYS = [
  'HKLM\\SOFTWARE\\Oracle\\VirtualBox',
  'HKLM\\SOFTWARE\\WOW6432Node\\Oracle\\VirtualBox'
]

const VMWARE_WIN_CANDIDATES = [
  'C:\\Program Files (x86)\\VMware\\VMware Workstation\\vmware.exe',
  'C:\\Program Files\\VMware\\VMware Workstation\\vmware.exe',
  'C:\\Program Files (x86)\\VMware\\VMware Player\\vmplayer.exe'
]

/** @typedef {'installed' | 'missing' | 'broken' | 'needs_setup' | 'running' | 'n/a'} ToolStatus */

/** @typedef {{
 *   id: string
 *   name: string
 *   status: ToolStatus
 *   version: string
 *   executablePath: string
 *   message: string
 *   installUrl: string
 *   variant: string
 * }} ToolDetectionResult */

const INSTALL_URLS = {
  docker: 'https://docs.docker.com/get-docker/',
  virtualbox: 'https://www.virtualbox.org/wiki/Downloads',
  vmware: 'https://www.vmware.com/products/desktop-hypervisor/workstation-and-fusion',
  hyperv: 'https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v',
  qemu: 'https://ubuntu.com/server/docs/virtualization-qemu',
  wsl: 'https://learn.microsoft.com/en-us/windows/wsl/install',
  virtualization: ''
}

/**
 * @param {ToolStatus} status
 */
function statusVariant(status) {
  if (status === 'installed' || status === 'running') return 'success'
  if (status === 'missing') return 'danger'
  if (status === 'broken') return 'warning'
  if (status === 'needs_setup' || status === 'n/a') return 'warning'
  return 'unknown'
}

/**
 * @param {{
 *   id: string
 *   name: string
 *   status: ToolStatus
 *   version?: string
 *   executablePath?: string
 *   message?: string
 *   installUrl?: string
 * }} fields
 * @returns {ToolDetectionResult}
 */
function buildToolResult(fields) {
  const status = fields.status
  return {
    id: fields.id,
    name: fields.name,
    status,
    version: fields.version ?? '',
    executablePath: fields.executablePath ?? '',
    message: fields.message ?? '',
    installUrl: fields.installUrl ?? INSTALL_URLS[fields.id] ?? '',
    variant: statusVariant(status)
  }
}

/**
 * @param {string} command
 * @param {string[]} [args]
 */
function runDetection(command, args = []) {
  return runCommand(command, args, { timeout: DETECTION_TIMEOUT_MS })
}

/**
 * @param {ToolDetectionResult} docker
 */
export function isDockerReady(docker) {
  return docker?.status === 'installed' || docker?.status === 'running'
}

/**
 * Resolve Docker CLI path (PATH first, then common Windows install locations).
 * @returns {Promise<string | null>}
 */
export async function resolveDockerCommand() {
  const pathResult = await runDetection('docker', ['--version'])
  if (pathResult.ok) return 'docker'

  if (process.platform === 'win32') {
    for (const candidate of WINDOWS_DOCKER_BIN_PATHS) {
      if (!fs.existsSync(candidate)) continue
      const result = await runDetection(candidate, ['--version'])
      if (result.ok) return candidate
    }
  }

  return null
}

export async function detectDocker() {
  try {
    const dockerBin = await resolveDockerCommand()
    if (!dockerBin) {
      return buildToolResult({
        id: 'docker',
        name: 'Docker',
        status: 'missing',
        message: 'Docker CLI not found in PATH or standard install locations',
        installUrl: INSTALL_URLS.docker
      })
    }

    const versionResult = await runDetection(dockerBin, ['--version'])
    if (!versionResult.ok) {
      return buildToolResult({
        id: 'docker',
        name: 'Docker',
        status: 'missing',
        message: 'Docker CLI not found in PATH',
        installUrl: INSTALL_URLS.docker
      })
    }

    const version = versionResult.stdout
      .replace(/^Docker version\s*/i, '')
      .split(',')[0]
      .trim()

    const infoResult = await runDetection(dockerBin, ['info', '--format', '{{.ServerVersion}}'])
    if (!infoResult.ok) {
      const stderr = infoResult.stderr || ''
      const daemonStopped = /cannot connect|daemon/i.test(stderr)
      return buildToolResult({
        id: 'docker',
        name: 'Docker',
        status: daemonStopped ? 'needs_setup' : 'broken',
        version,
        message: daemonStopped
          ? 'Docker is installed but the daemon is not running'
          : stderr || 'Docker installed but not responding correctly',
        installUrl: INSTALL_URLS.docker
      })
    }

    return buildToolResult({
      id: 'docker',
      name: 'Docker',
      status: 'installed',
      version: version || infoResult.stdout,
      executablePath: dockerBin === 'docker' ? '' : dockerBin,
      message: 'Docker daemon is running',
      installUrl: INSTALL_URLS.docker
    })
  } catch (error) {
    logger.warn('tools', 'Docker detection failed', error)
    return buildToolResult({
      id: 'docker',
      name: 'Docker',
      status: 'broken',
      message: 'Docker detection failed unexpectedly',
      installUrl: INSTALL_URLS.docker
    })
  }
}

async function getVirtualBoxInstallDirFromRegistry() {
  for (const key of VBOX_REGISTRY_KEYS) {
    const result = await runDetection('reg', ['query', key])
    if (!result.ok) continue

    const installDirMatch = result.stdout.match(/InstallDir\s+REG_\w+\s+(.+)/i)
    if (installDirMatch?.[1]) {
      return installDirMatch[1].trim().replace(/\\+$/, '')
    }
  }

  const ps = await runDetection('powershell', [
    '-NoProfile',
    '-Command',
    "$keys=@('HKLM:\\SOFTWARE\\Oracle\\VirtualBox','HKLM:\\SOFTWARE\\WOW6432Node\\Oracle\\VirtualBox'); foreach($k in $keys){ $p=Get-ItemProperty -Path $k -ErrorAction SilentlyContinue; if($p.InstallDir){ $p.InstallDir; break } }"
  ])
  if (ps.ok && ps.stdout.trim()) {
    return ps.stdout.trim().replace(/\\+$/, '')
  }

  return null
}

async function getVBoxManageFromPathEnv() {
  if (process.platform === 'win32') {
    const where = await runDetection('where.exe', ['VBoxManage'])
    if (!where.ok) return []

    return where.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.toLowerCase().endsWith('vboxmanage.exe') && fs.existsSync(line))
  }

  const which = await runDetection('which', ['VBoxManage'])
  if (which.ok && which.stdout.trim()) {
    return [which.stdout.split(/\r?\n/)[0].trim()]
  }

  return []
}

function dedupePaths(paths) {
  const seen = new Set()
  return paths.filter((entry) => {
    const key = entry.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * @param {string} executablePath
 */
async function probeVBoxManageExecutable(executablePath) {
  const result = await runDetection(executablePath, ['--version'])
  if (result.ok) {
    return buildToolResult({
      id: 'virtualbox',
      name: 'VirtualBox',
      status: 'installed',
      version: result.stdout.split(/\r?\n/)[0].trim(),
      executablePath,
      message: 'VirtualBox is installed',
      installUrl: INSTALL_URLS.virtualbox
    })
  }
  return buildToolResult({
    id: 'virtualbox',
    name: 'VirtualBox',
    status: 'broken',
    executablePath,
    message: result.stderr || 'VBoxManage.exe found but --version failed',
    installUrl: INSTALL_URLS.virtualbox
  })
}

async function detectVirtualBoxWindows() {
  const candidates = []

  for (const installPath of WINDOWS_VBOX_MANAGE_PATHS) {
    if (fs.existsSync(installPath)) candidates.push(installPath)
  }

  const installDir = await getVirtualBoxInstallDirFromRegistry()
  if (installDir) {
    const registryExe = path.join(installDir, 'VBoxManage.exe')
    if (fs.existsSync(registryExe)) candidates.push(registryExe)
  }

  candidates.push(...(await getVBoxManageFromPathEnv()))

  let lastBroken = null
  for (const executablePath of dedupePaths(candidates)) {
    const probe = await probeVBoxManageExecutable(executablePath)
    if (probe.status === 'installed') return probe
    lastBroken = probe
  }

  const pathFallback = await runDetection('VBoxManage', ['--version'])
  if (pathFallback.ok) {
    const resolved =
      dedupePaths(candidates)[0] ?? (await getVBoxManageFromPathEnv())[0] ?? 'VBoxManage'
    return buildToolResult({
      id: 'virtualbox',
      name: 'VirtualBox',
      status: 'installed',
      version: pathFallback.stdout.split(/\r?\n/)[0].trim(),
      executablePath: resolved,
      message: 'VirtualBox is installed',
      installUrl: INSTALL_URLS.virtualbox
    })
  }

  if (lastBroken) return lastBroken

  return buildToolResult({
    id: 'virtualbox',
    name: 'VirtualBox',
    status: 'missing',
    message: 'VirtualBox not found',
    installUrl: INSTALL_URLS.virtualbox
  })
}

async function detectVirtualBoxUnix() {
  const pathCandidates = await getVBoxManageFromPathEnv()
  let lastBroken = null

  for (const executablePath of dedupePaths(pathCandidates)) {
    const probe = await probeVBoxManageExecutable(executablePath)
    if (probe.status === 'installed') return probe
    lastBroken = probe
  }

  const pathFallback = await runDetection('VBoxManage', ['--version'])
  if (pathFallback.ok) {
    return buildToolResult({
      id: 'virtualbox',
      name: 'VirtualBox',
      status: 'installed',
      version: pathFallback.stdout.split(/\r?\n/)[0].trim(),
      executablePath: pathCandidates[0] ?? 'VBoxManage',
      message: 'VirtualBox is installed',
      installUrl: INSTALL_URLS.virtualbox
    })
  }

  if (lastBroken) return lastBroken

  return buildToolResult({
    id: 'virtualbox',
    name: 'VirtualBox',
    status: 'missing',
    message: 'VirtualBox not found',
    installUrl: INSTALL_URLS.virtualbox
  })
}

export async function detectVirtualBox() {
  try {
    if (process.platform === 'win32') {
      return await detectVirtualBoxWindows()
    }
    return await detectVirtualBoxUnix()
  } catch (error) {
    logger.warn('tools', 'VirtualBox detection failed', error)
    return buildToolResult({
      id: 'virtualbox',
      name: 'VirtualBox',
      status: 'broken',
      message: 'VirtualBox detection failed unexpectedly',
      installUrl: INSTALL_URLS.virtualbox
    })
  }
}

export async function detectVMware() {
  try {
    const cliCommands = ['vmware', 'vmrun', 'vmplayer']
    for (const command of cliCommands) {
      const result = await runDetection(command, ['-v'])
      if (result.ok) {
        return buildToolResult({
          id: 'vmware',
          name: 'VMware',
          status: 'installed',
          version: result.stdout.split(/\r?\n/)[0].trim(),
          executablePath: command,
          message: 'VMware command-line tools detected',
          installUrl: INSTALL_URLS.vmware
        })
      }
    }

    if (process.platform === 'win32') {
      const where = await runDetection('where.exe', ['vmware'])
      if (where.ok) {
        const exe = where.stdout.split(/\r?\n/)[0]?.trim()
        if (exe && fs.existsSync(exe)) {
          return buildToolResult({
            id: 'vmware',
            name: 'VMware',
            status: 'installed',
            executablePath: exe,
            message: 'VMware executable found',
            installUrl: INSTALL_URLS.vmware
          })
        }
      }

      for (const candidate of VMWARE_WIN_CANDIDATES) {
        if (fs.existsSync(candidate)) {
          return buildToolResult({
            id: 'vmware',
            name: 'VMware',
            status: 'installed',
            executablePath: candidate,
            message: 'VMware installation found (CLI not in PATH)',
            installUrl: INSTALL_URLS.vmware
          })
        }
      }
    }

    return buildToolResult({
      id: 'vmware',
      name: 'VMware',
      status: 'missing',
      message: 'VMware not detected (optional for future VM labs)',
      installUrl: INSTALL_URLS.vmware
    })
  } catch (error) {
    logger.warn('tools', 'VMware detection failed', error)
    return buildToolResult({
      id: 'vmware',
      name: 'VMware',
      status: 'missing',
      message: 'VMware detection unavailable',
      installUrl: INSTALL_URLS.vmware
    })
  }
}

export async function detectHyperV() {
  if (process.platform !== 'win32') {
    return buildToolResult({
      id: 'hyperv',
      name: 'Hyper-V',
      status: 'n/a',
      message: 'Hyper-V is Windows-only',
      installUrl: INSTALL_URLS.hyperv
    })
  }

  try {
    const result = await runDetection('powershell', [
      '-NoProfile',
      '-Command',
      '(Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All).State'
    ])
    if (/Enabled/i.test(result.stdout)) {
      return buildToolResult({
        id: 'hyperv',
        name: 'Hyper-V',
        status: 'installed',
        message: 'Hyper-V feature is enabled',
        installUrl: INSTALL_URLS.hyperv
      })
    }
    return buildToolResult({
      id: 'hyperv',
      name: 'Hyper-V',
      status: 'missing',
      message: 'Hyper-V is not enabled on this system',
      installUrl: INSTALL_URLS.hyperv
    })
  } catch (error) {
    logger.warn('tools', 'Hyper-V detection failed', error)
    return buildToolResult({
      id: 'hyperv',
      name: 'Hyper-V',
      status: 'missing',
      message: 'Could not determine Hyper-V status',
      installUrl: INSTALL_URLS.hyperv
    })
  }
}

export async function detectQemu() {
  if (process.platform === 'win32') {
    return buildToolResult({
      id: 'qemu',
      name: 'QEMU/KVM',
      status: 'n/a',
      message: 'QEMU/KVM detection is Linux-focused in this release',
      installUrl: INSTALL_URLS.qemu
    })
  }

  try {
    const qemu = await runDetection('qemu-system-x86_64', ['--version'])
    const virsh = await runDetection('virsh', ['--version'])
    if (qemu.ok || virsh.ok) {
      const version = [
        qemu.ok ? qemu.stdout.split(/\r?\n/)[0] : '',
        virsh.ok ? `libvirt ${virsh.stdout.trim()}` : ''
      ]
        .filter(Boolean)
        .join(' · ')
      return buildToolResult({
        id: 'qemu',
        name: 'QEMU/KVM',
        status: 'installed',
        version,
        executablePath: qemu.ok ? 'qemu-system-x86_64' : 'virsh',
        message: 'QEMU or libvirt tools detected',
        installUrl: INSTALL_URLS.qemu
      })
    }
    return buildToolResult({
      id: 'qemu',
      name: 'QEMU/KVM',
      status: 'missing',
      message: 'QEMU/KVM not detected',
      installUrl: INSTALL_URLS.qemu
    })
  } catch (error) {
    logger.warn('tools', 'QEMU detection failed', error)
    return buildToolResult({
      id: 'qemu',
      name: 'QEMU/KVM',
      status: 'missing',
      message: 'QEMU detection unavailable',
      installUrl: INSTALL_URLS.qemu
    })
  }
}

export async function detectWsl() {
  const { detectWslEnvironment } = await import('./wsl/wslDetection.js')

  if (process.platform !== 'win32') {
    const snap = await detectWslEnvironment()
    return {
      ...buildToolResult({
        id: 'wsl',
        name: 'WSL',
        status: 'n/a',
        message: snap.statusMessage,
        installUrl: INSTALL_URLS.wsl
      }),
      wslDetails: snap
    }
  }

  try {
    const snap = await detectWslEnvironment()
    let status = 'missing'
    if (snap.installed && snap.wsl2Available) {
      status = 'installed'
    } else if (snap.installed) {
      status = 'needs_setup'
    }

    return {
      ...buildToolResult({
        id: 'wsl',
        name: 'WSL',
        status,
        version: snap.defaultVersion != null ? `WSL ${snap.defaultVersion}` : '',
        message: snap.statusMessage,
        installUrl: INSTALL_URLS.wsl
      }),
      wslDetails: snap
    }
  } catch (error) {
    logger.warn('tools', 'WSL detection failed', error)
    return {
      ...buildToolResult({
        id: 'wsl',
        name: 'WSL',
        status: 'missing',
        message: 'WSL detection unavailable',
        installUrl: INSTALL_URLS.wsl
      }),
      wslDetails: null
    }
  }
}

export async function detectVirtualization() {
  try {
    if (process.platform === 'win32') {
      const ps = await runDetection('powershell', [
        '-NoProfile',
        '-Command',
        '(Get-CimInstance Win32_ComputerSystem).HypervisorPresent'
      ])
      if (ps.ok && /true/i.test(ps.stdout)) {
        return buildToolResult({
          id: 'virtualization',
          name: 'Virtualization',
          status: 'installed',
          message: 'Hypervisor / virtualization appears enabled'
        })
      }
      return buildToolResult({
        id: 'virtualization',
        name: 'Virtualization',
        status: 'needs_setup',
        message: 'Virtualization may be disabled in firmware or OS settings'
      })
    }

    if (os.platform() === 'linux') {
      const kvm = await runDetection('test', ['-e', '/dev/kvm'])
      if (kvm.ok) {
        return buildToolResult({
          id: 'virtualization',
          name: 'Virtualization',
          status: 'installed',
          message: 'KVM device available at /dev/kvm'
        })
      }
      return buildToolResult({
        id: 'virtualization',
        name: 'Virtualization',
        status: 'needs_setup',
        message: '/dev/kvm not found — enable KVM in BIOS if needed'
      })
    }

    return buildToolResult({
      id: 'virtualization',
      name: 'Virtualization',
      status: 'n/a',
      message: 'Check virtualization in system settings'
    })
  } catch (error) {
    logger.warn('tools', 'Virtualization detection failed', error)
    return buildToolResult({
      id: 'virtualization',
      name: 'Virtualization',
      status: 'n/a',
      message: 'Virtualization detection unavailable'
    })
  }
}

/** Run all tool probes (VM + platform helpers). */
export async function detectAllTools() {
  return Promise.all([
    detectDocker(),
    detectVirtualBox(),
    detectVMware(),
    detectHyperV(),
    detectQemu(),
    detectWsl(),
    detectVirtualization()
  ])
}
