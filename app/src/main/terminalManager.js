/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { spawn } from 'child_process'
import crypto from 'crypto'
import os from 'os'
import * as dockerManager from './dockerManager.js'
import { getSessionState } from './labManager.js'
import { sessionIsTargetOnlyLab } from './lab/labMode.js'
import {
  sessionUsesLocalTerminalWorkstation,
  sessionUsesVmWorkstation
} from './workstation/workstationSession.js'
import { createTerminalTrace } from './terminalDebug.js'
import { resolveDockerCommand } from './toolDetection.js'
import { assertSafeSessionId } from './utils/sanitize.js'
import { formatNativeModuleLoadError } from './utils/nativeModuleHelp.js'
import { logger } from './utils/logger.js'
import { normalizeWorkstationLoginMode } from '@sysadmin-game/shared/workstations/workstationLoginMode.js'

/** @type {Map<string, { pty: import('node-pty').IPty, sessionId: string, sender: import('electron').WebContents, containerId: string }>} */
const terminals = new Map()

const ALLOWED_SHELL = '/bin/bash'
const ALLOWED_FALLBACK_SHELL = '/bin/sh'
const ALLOWED_LOGIN = '/bin/login'
const CONTAINER_TTY_LOGIN = '/usr/local/bin/sgq-tty-login.sh'
const MAX_WRITE_BYTES = 32 * 1024
const DEFAULT_COLS = 100
const DEFAULT_ROWS = 28
const HELPER_WAIT_MS = 10_000
const HELPER_POLL_MS = 500

const HELPER_START_ERROR =
  'Lab workstation failed to start. Restart the lab and try again.'

const SSH_PORT_HINT =
  'From lab-workstation use: ssh USER@<lab-target-ip>  (private Docker session network)\r\n'

const SSH_LOOPBACK_MISTAKE_HINT =
  '\r\n\x1b[33m127.0.0.1 / localhost is this workstation, not the lab target.\x1b[0m\r\n' +
  '\x1b[33mUse the internal IP from Lab Target Access: ssh USER@<lab-target-ip>\x1b[0m\r\n'

/** @type {Map<string, string>} */
const terminalInputBuffers = new Map()

/** @type {import('node-pty') | null} */
let ptyModule = null
/** @type {Error | null} */
let ptyLoadError = null

/**
 * Lazy-load node-pty so the main process can start even if native rebuild failed.
 */
async function loadNodePty() {
  if (ptyModule) return ptyModule
  if (ptyLoadError) throw ptyLoadError
  try {
    const mod = await import('node-pty')
    ptyModule = mod.default ?? mod
    logger.info('terminal', 'node-pty module loaded')
    return ptyModule
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ptyLoadError = new Error(formatNativeModuleLoadError(message))
    logger.error('terminal', 'node-pty load failed', { message })
    throw ptyLoadError
  }
}

/**
 * @returns {Promise<{ available: boolean, message?: string }>}
 */
export async function checkPtyAvailable() {
  try {
    await loadNodePty()
    return { available: true }
  } catch (error) {
    return {
      available: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * @param {import('electron').WebContents} sender
 * @param {string} terminalId
 * @param {string | Buffer} data
 */
function emitTerminalData(sender, terminalId, data) {
  if (sender.isDestroyed()) return
  sender.send('terminal:data', { terminalId, data: data.toString() })
}

/**
 * @param {import('electron').WebContents} sender
 * @param {string} terminalId
 * @param {number} code
 */
function emitTerminalExit(sender, terminalId, code) {
  if (sender.isDestroyed()) return
  sender.send('terminal:exit', { terminalId, code })
}

/**
 * @param {{ helper?: { containerId?: string }, containerId?: string }} session
 */
function resolveTerminalContainerId(session) {
  return session.helper?.containerId ?? session.containerId ?? null
}

/**
 * @param {string} containerId
 * @param {ReturnType<typeof createTerminalTrace>} trace
 */
async function fetchHelperFailureDetails(containerId, trace) {
  const state = await dockerManager.inspectContainerState(containerId).catch(() => null)
  const logResult = await dockerManager.getContainerLogs(containerId, { tail: 120 })
  const details = {
    status: state?.status ?? 'unknown',
    exitCode: state?.exitCode ?? null,
    logs: logResult.logs?.slice(0, 4000) ?? ''
  }
  trace?.log('helper.container.failure_details', details)
  logger.error('terminal', 'Sandbox helper failure details', { containerId, ...details })
  return details
}

/**
 * @param {object} session
 * @param {ReturnType<typeof createTerminalTrace>} trace
 */
async function ensureHelperContainerReady(session, trace) {
  const containerId = resolveTerminalContainerId(session)
  const helperName = session.helper?.containerName ?? null

  if (!containerId) {
    throw new Error('No helper container is attached to this lab session. Restart the lab and try again.')
  }

  trace?.log('helper.container.detected', { containerId, helperName })
  logger.info('terminal', 'Waiting for sandbox helper container', { containerId, helperName })

  const started = Date.now()
  while (Date.now() - started < HELPER_WAIT_MS) {
    try {
      const state = await dockerManager.inspectContainerState(containerId)
      if (state.running) {
        trace?.log('helper.container.running', { containerId, status: state.status })
        logger.info('terminal', 'Sandbox helper container running', { containerId, helperName })
        return containerId
      }

      trace?.log('helper.container.waiting', {
        containerId,
        status: state.status,
        exitCode: state.exitCode
      })

      if (state.status === 'exited' || state.status === 'dead') {
        trace?.log('helper.container.exited', {
          containerId,
          status: state.status,
          exitCode: state.exitCode,
          error: state.error
        })
        logger.error('terminal', 'Sandbox helper container exited', {
          containerId,
          helperName,
          exitCode: state.exitCode,
          error: state.error
        })
        const details = await fetchHelperFailureDetails(containerId, trace)
        const err = new Error(HELPER_START_ERROR)
        err.helperDebug = details
        throw err
      }
    } catch (error) {
      if (error instanceof Error && error.message === HELPER_START_ERROR) {
        throw error
      }
      trace?.log('helper.container.inspect_failed', {
        containerId,
        message: error instanceof Error ? error.message : String(error)
      })
    }
    await new Promise((resolve) => setTimeout(resolve, HELPER_POLL_MS))
  }

  const details = await fetchHelperFailureDetails(containerId, trace)
  const err = new Error(HELPER_START_ERROR)
  err.helperDebug = details
  throw err
}

/**
 * PTY into the sandbox workstation login prompt (no pre-authenticated shell).
 * @param {import('node-pty')} pty
 * @param {string} dockerBin
 * @param {string} containerId
 * @param {string} loginBin
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} interactiveTty
 */
function spawnDockerLoginPty(pty, dockerBin, containerId, loginBin, cols, rows, interactiveTty) {
  const ttyFlag = interactiveTty ? '-it' : '-i'
  const execArgs = ['exec', ttyFlag, '-e', 'TERM=xterm-256color', containerId, loginBin]
  return pty.spawn(dockerBin, execArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM: 'xterm-256color'
    }
  })
}

/**
 * PTY into the sandbox workstation (terminal-helper), not the lab target.
 * @param {import('node-pty')} pty
 * @param {string} dockerBin
 * @param {string} containerId
 * @param {string} shell
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} interactiveTty
 * @param {string} execUser
 * @param {string} homeDir
 */
function spawnDockerExecPty(
  pty,
  dockerBin,
  containerId,
  shell,
  cols,
  rows,
  interactiveTty,
  execUser,
  homeDir,
  isWindows
) {
  const ttyFlag = interactiveTty ? '-it' : '-i'
  /** @type {string[]} */
  const execArgs = ['exec', ttyFlag, '-e', 'TERM=xterm-256color']

  if (isWindows) {
    execArgs.push('-w', homeDir, containerId, shell, '-NoLogo')
  } else {
    const ps1 = `${execUser}@lab-workstation:\\w$ `
    execArgs.push(
      '-e',
      `PS1=${ps1}`,
      '-e',
      `HOME=${homeDir}`,
      '-u',
      execUser,
      '-w',
      homeDir,
      containerId,
      shell,
      '-l'
    )
  }
  return pty.spawn(dockerBin, execArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM: 'xterm-256color'
    }
  })
}

/**
 * @param {string} sessionId
 */
export function getTerminalStatusForSession(sessionId) {
  for (const [terminalId, entry] of terminals.entries()) {
    if (entry.sessionId === sessionId) {
      return {
        attached: true,
        terminalId,
        sessionId
      }
    }
  }
  return { attached: false, terminalId: null, sessionId }
}

/**
 * @param {string} sessionId
 * @param {import('electron').WebContents} sender
 * @param {{ cols?: number, rows?: number }} [options]
 */
export async function attachLabTerminal(sessionId, sender, options = {}) {
  assertSafeSessionId(sessionId)
  const trace = createTerminalTrace(sessionId)
  trace.log('xterm.renderer.attach_requested', { cols: options.cols, rows: options.rows })

  const ptyCheck = await checkPtyAvailable()
  if (!ptyCheck.available) {
    trace.log('node-pty.unavailable', { message: ptyCheck.message })
    throw new Error(ptyCheck.message ?? 'node-pty is not available')
  }
  trace.log('node-pty.available')

  const existing = getTerminalStatusForSession(sessionId)
  if (existing.attached && existing.terminalId) {
    const entry = terminals.get(existing.terminalId)
    if (entry && entry.sender.id === sender.id) {
      trace.log('pty.reused', { terminalId: existing.terminalId })
      return {
        terminalId: existing.terminalId,
        shell: ALLOWED_SHELL,
        containerOnly: true,
        helperOnly: true,
        reused: true
      }
    }
    detachLabTerminal(existing.terminalId)
  }

  const session = getSessionState(sessionId)
  if (session.status !== 'running') {
    throw new Error('Lab session is not running')
  }

  if (sessionIsTargetOnlyLab(session)) {
    const containerId = session.helper?.targetContainerId ?? session.containerId
    if (!containerId) {
      throw new Error('Lab target container is not available')
    }
    const execUser = session.credentials?.username
    if (!execUser) {
      throw new Error('Lab session credentials are not available')
    }
    const homeDir = `/home/${execUser}`
    const dockerBin = await resolveDockerCommand()
    if (!dockerBin) {
      throw new Error('Docker CLI not available for integrated terminal')
    }
    const pty = await loadNodePty()
    const terminalId = crypto.randomBytes(8).toString('hex')
    const cols = options.cols ?? DEFAULT_COLS
    const rows = options.rows ?? DEFAULT_ROWS
    const shell = ALLOWED_SHELL
    let ptyProcess
    try {
      ptyProcess = spawnDockerExecPty(
        pty,
        dockerBin,
        containerId,
        shell,
        cols,
        rows,
        true,
        execUser,
        homeDir,
        false
      )
      trace.log('terminal.pty.created', { mode: 'docker exec lab target (target-only)', containerId, execUser })
    } catch (error) {
      trace.log('terminal.pty.create.failed', {
        message: error instanceof Error ? error.message : String(error)
      })
      throw new Error(
        `Could not start lab terminal: ${error instanceof Error ? error.message : String(error)}`
      )
    }
    terminals.set(terminalId, { pty: ptyProcess, sessionId, sender, containerId })
    ptyProcess.onData((chunk) => emitTerminalData(sender, terminalId, chunk))
    ptyProcess.onExit(({ exitCode }) => {
      terminals.delete(terminalId)
      trace.log('pty.exited', { exitCode })
      emitTerminalExit(sender, terminalId, exitCode ?? 0)
    })
    trace.log('pty.attached.successfully', { terminalId, containerId })
    logger.info('terminal', 'PTY attach succeeded (target-only)', { sessionId, terminalId, containerId, execUser })
    return {
      terminalId,
      shell,
      containerOnly: true,
      helperOnly: false,
      targetOnly: true,
      reused: false
    }
  }

  if (sessionUsesVmWorkstation(session)) {
    throw new Error(
      'This session uses a VirtualBox VM workstation. Use Open VM Window from the mission panel instead of the Docker lab terminal.'
    )
  }

  if (sessionUsesLocalTerminalWorkstation(session)) {
    throw new Error(
      'This session uses Local Terminal Workstation. Use Open Local Terminal from the mission panel — commands run on your real system.'
    )
  }

  const accessModes = session.helper?.workstationAccessModes ?? ['terminal']
  if (
    (typeof session.helper?.workstationProvider === 'string' &&
      session.helper.workstationProvider.startsWith('desktop-container-')) ||
    (accessModes.includes('desktop') && !accessModes.includes('terminal'))
  ) {
    throw new Error(
      'This session uses a Windows Desktop workstation. Use Open Desktop from the mission panel instead of the integrated lab terminal.'
    )
  }

  const containerId = await ensureHelperContainerReady(session, trace)
  const execUser = session.workstationCredentials?.username ?? session.credentials?.username
  if (!execUser) {
    throw new Error('Lab session credentials are not available')
  }
  const loginMode = normalizeWorkstationLoginMode(session.workstationCredentials?.loginMode)
  const useTtyLogin =
    session.helper?.workstationPlatform !== 'windows' && loginMode === 'tty-login'
  const isWindows = session.helper?.workstationPlatform === 'windows'
  const homeDir = isWindows ? `C:\\Users\\${execUser}` : `/home/${execUser}`
  const preferredShell =
    session.helper?.workstationTerminalShell ??
    (isWindows ? 'powershell.exe' : ALLOWED_SHELL)

  const dockerBin = await resolveDockerCommand()
  if (!dockerBin) {
    throw new Error('Docker CLI not available for integrated terminal')
  }

  const pty = await loadNodePty()
  const terminalId = crypto.randomBytes(8).toString('hex')
  const cols = options.cols ?? DEFAULT_COLS
  const rows = options.rows ?? DEFAULT_ROWS

  const shellCheck = await new Promise((resolve) => {
    if (useTtyLogin) {
      const checkArgs = ['exec', containerId, 'test', '-x', CONTAINER_TTY_LOGIN]
      const check = spawn(dockerBin, checkArgs, { windowsHide: true })
      check.on('close', (code) => {
        if (code === 0) {
          resolve(CONTAINER_TTY_LOGIN)
          return
        }
        const fallbackArgs = ['exec', containerId, 'test', '-x', ALLOWED_LOGIN]
        const fallback = spawn(dockerBin, fallbackArgs, { windowsHide: true })
        fallback.on('close', (fallbackCode) => {
          resolve(fallbackCode === 0 ? ALLOWED_LOGIN : null)
        })
        fallback.on('error', () => resolve(null))
      })
      check.on('error', () => resolve(null))
      return
    }
    const checkArgs = isWindows
      ? ['exec', '-w', homeDir, containerId, 'powershell.exe', '-NoLogo', '-Command', 'exit 0']
      : [
          'exec',
          '-u',
          execUser,
          '-w',
          homeDir,
          containerId,
          'test',
          '-x',
          ALLOWED_SHELL
        ]
    const check = spawn(dockerBin, checkArgs, { windowsHide: true })
    check.on('close', (code) => resolve(code === 0))
    check.on('error', () => resolve(false))
  })

  const shell = useTtyLogin
    ? shellCheck ?? CONTAINER_TTY_LOGIN
    : isWindows
      ? preferredShell
      : shellCheck
        ? ALLOWED_SHELL
        : ALLOWED_FALLBACK_SHELL

  if (useTtyLogin && !shellCheck) {
    throw new Error('Workstation login helper is missing. Rebuild the lab workstation image and restart the lab.')
  }
  trace.log('terminal.pty.create.started', {
    containerId,
    shell,
    execUser,
    homeDir,
    cols,
    rows,
    workstation: true,
    loginMode,
    useTtyLogin
  })
  logger.info('terminal', 'PTY attach started (lab workstation)', {
    sessionId,
    containerId,
    execUser,
    shell,
    loginMode,
    useTtyLogin
  })

  let ptyProcess
  try {
    if (useTtyLogin) {
      ptyProcess = spawnDockerLoginPty(pty, dockerBin, containerId, shell, cols, rows, true)
      trace.log('terminal.pty.created', {
        mode: 'docker exec workstation tty login',
        containerId,
        shell,
        loginMode
      })
    } else {
      ptyProcess = spawnDockerExecPty(
        pty,
        dockerBin,
        containerId,
        shell,
        cols,
        rows,
        true,
        execUser,
        homeDir,
        isWindows
      )
      trace.log('terminal.pty.created', {
        mode: 'docker exec workstation shell',
        containerId,
        shell,
        execUser,
        loginMode
      })
    }
  } catch (error) {
    trace.log('terminal.pty.it_failed', {
      message: error instanceof Error ? error.message : String(error)
    })
    try {
      if (useTtyLogin) {
        ptyProcess = spawnDockerLoginPty(pty, dockerBin, containerId, shell, cols, rows, false)
        trace.log('terminal.pty.created', {
          mode: 'docker exec workstation tty login (fallback -i)',
          containerId,
          shell
        })
      } else {
        ptyProcess = spawnDockerExecPty(
          pty,
          dockerBin,
          containerId,
          shell,
          cols,
          rows,
          false,
          execUser,
          homeDir,
          isWindows
        )
        trace.log('terminal.pty.created', {
          mode: 'docker exec workstation shell (fallback -i)',
          containerId,
          shell
        })
      }
    } catch (fallbackError) {
      trace.log('terminal.pty.create.failed', {
        message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      })
      logger.error('terminal', 'PTY attach failed', {
        sessionId,
        containerId,
        message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      })
      throw new Error(
        `Could not start sandbox terminal: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      )
    }
  }

  terminals.set(terminalId, { pty: ptyProcess, sessionId, sender, containerId })

  ptyProcess.onData((chunk) => emitTerminalData(sender, terminalId, chunk))
  ptyProcess.onExit(({ exitCode }) => {
    terminals.delete(terminalId)
    trace.log('pty.exited', { exitCode })
    emitTerminalExit(sender, terminalId, exitCode ?? 0)
  })

  trace.log('pty.attached.successfully', { terminalId, containerId })
  logger.info('terminal', 'PTY attach succeeded', { sessionId, terminalId, containerId, execUser })

  return {
    terminalId,
    shell,
    containerOnly: true,
    helperOnly: true,
    workstation: true,
    loginMode,
    ttyLogin: useTtyLogin,
    reused: false
  }
}

/**
 * @param {string} terminalId
 * @param {string} data
 */
/**
 * @param {string} line
 */
function shouldEmitSshPortHint(line) {
  const trimmed = line.trim()
  if (!/^ssh\b/i.test(trimmed)) return false
  if (/\blab-target\b/i.test(trimmed)) return false
  if (/\blab-route\b/i.test(trimmed)) return false
  if (/\s-p\s|--port[=\s]/i.test(trimmed)) return false
  return true
}

function shouldEmitLoopbackMistakeHint(line) {
  const trimmed = line.trim()
  if (!/^ssh\b/i.test(trimmed)) return false
  return /127\.0\.0\.1|localhost/.test(trimmed)
}

/**
 * @param {string} terminalId
 * @param {string} data
 * @param {import('electron').WebContents} sender
 */
function handleTerminalInputHints(terminalId, data, sender) {
  let buffer = terminalInputBuffers.get(terminalId) ?? ''
  for (const ch of data) {
    if (ch === '\r' || ch === '\n') {
      if (shouldEmitLoopbackMistakeHint(buffer)) {
        emitTerminalData(sender, terminalId, SSH_LOOPBACK_MISTAKE_HINT)
      } else if (shouldEmitSshPortHint(buffer)) {
        emitTerminalData(sender, terminalId, `\r\n\x1b[33m${SSH_PORT_HINT}\x1b[0m`)
      }
      buffer = ''
      continue
    }
    if (ch === '\u007f' || ch === '\b') {
      buffer = buffer.slice(0, -1)
      continue
    }
    if (ch >= ' ' || ch === '\t') {
      buffer += ch
      if (buffer.length > 512) buffer = buffer.slice(-512)
    }
  }
  terminalInputBuffers.set(terminalId, buffer)
}

export function writeLabTerminal(terminalId, data) {
  const entry = terminals.get(terminalId)
  if (!entry) {
    throw new Error('Terminal not found')
  }
  if (typeof data !== 'string' || data.length === 0 || data.length > MAX_WRITE_BYTES) {
    throw new Error('Invalid terminal input')
  }
  handleTerminalInputHints(terminalId, data, entry.sender)
  entry.pty.write(data)
  return { ok: true }
}

/**
 * @param {string} terminalId
 * @param {number} cols
 * @param {number} rows
 */
export function resizeLabTerminal(terminalId, cols, rows) {
  const entry = terminals.get(terminalId)
  if (!entry) {
    throw new Error('Terminal not found')
  }
  if (!Number.isFinite(cols) || !Number.isFinite(rows) || cols < 1 || rows < 1) {
    throw new Error('Invalid terminal size')
  }
  entry.pty.resize(Math.floor(cols), Math.floor(rows))
  return { ok: true }
}

/**
 * @param {string} terminalId
 */
export function detachLabTerminal(terminalId) {
  const entry = terminals.get(terminalId)
  if (!entry) return { detached: false }
  try {
    entry.pty.kill()
  } catch {
    // ignore
  }
  terminals.delete(terminalId)
  terminalInputBuffers.delete(terminalId)
  return { detached: true }
}

/**
 * @param {string} sessionId
 */
export function detachTerminalsForSession(sessionId) {
  assertSafeSessionId(sessionId)
  for (const [terminalId, entry] of terminals.entries()) {
    if (entry.sessionId === sessionId) {
      detachLabTerminal(terminalId)
    }
  }
  return { ok: true }
}

export function detachAllTerminals() {
  for (const terminalId of [...terminals.keys()]) {
    detachLabTerminal(terminalId)
  }
  return { ok: true }
}
