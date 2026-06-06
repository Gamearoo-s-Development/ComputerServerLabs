/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { inferFileStage } from './labTemplateVariables.js'
import { buildTemplateContext, renderTemplateString } from './labTemplateVariables.js'

/** @typedef {{ path?: string, content?: string, owner?: string, group?: string, mode?: string, stage?: string, target?: string, type?: string }} FsEntry */
/** @typedef {{ files: FsEntry[], directories: FsEntry[], symlinks?: FsEntry[] }} FsScope */

const DANGEROUS_PATH_PREFIXES = [
  '/proc',
  '/sys',
  '/dev',
  '/run/docker.sock',
  '/var/run/docker.sock',
  '/host',
  '/mnt/host'
]

const ALLOWED_PREFIXES_NORMAL = [
  '/home/',
  '/etc/',
  '/var/',
  '/opt/',
  '/srv/',
  '/tmp/',
  '/usr/local/',
  '/var/www/'
]

const ALLOWED_PREFIXES_ROOT = [...ALLOWED_PREFIXES_NORMAL, '/root/', '/root']

/**
 * @param {object} [lab]
 */
export function normalizeTargetUser(lab) {
  const raw = lab?.targetUser ?? {}
  const mode = raw.mode === 'root' ? 'root' : 'generated-user'
  const allowRoot = raw.allowRoot === true
  const loginDirectory = raw.loginDirectory === 'auto' ? 'auto' : raw.loginDirectory

  if (mode === 'root' && !allowRoot) {
    return { mode: 'generated-user', allowRoot: false, loginDirectory: 'auto', rootRejected: true }
  }

  return {
    mode: mode === 'root' && allowRoot ? 'root' : 'generated-user',
    allowRoot: mode === 'root' && allowRoot,
    loginDirectory,
    rootRejected: false
  }
}

/**
 * @param {ReturnType<typeof normalizeTargetUser>} targetUser
 * @param {string} [username]
 */
export function resolveLoginDir(targetUser, username = 'labuser') {
  if (targetUser.mode === 'root') return '/root'
  return `/home/${username}`
}

/**
 * @param {ReturnType<typeof normalizeTargetUser>} targetUser
 * @param {string} [username]
 */
export function resolveLoginUser(targetUser, username = 'labuser') {
  if (targetUser.mode === 'root') return 'root'
  return username
}

/**
 * @param {object} params
 */
export function buildFilesystemTemplateContext(params) {
  const targetUser = normalizeTargetUser({ targetUser: params.targetUser })
  const username = params.username ?? 'labuser_preview'
  const loginDir = resolveLoginDir(targetUser, username)
  const loginUser = resolveLoginUser(targetUser, username)

  return {
    ...buildTemplateContext(params),
    LOGIN_DIR: loginDir,
    LOGIN_USER: loginUser
  }
}

/**
 * @param {FsEntry[]} entries
 */
function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return []
  return entries
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      ...e,
      stage: inferFileStage(e),
      type: e.type === 'symlink' ? 'symlink' : 'file'
    }))
}

/**
 * @param {object} lab
 * @returns {{ target: FsScope, workstation: FsScope }}
 */
export function normalizeLabFilesystem(lab) {
  const targetUser = normalizeTargetUser(lab)

  /** @type {FsScope} */
  let target = {
    files: [],
    directories: [],
    symlinks: []
  }

  if (lab.filesystem?.target) {
    target = {
      files: normalizeEntries(lab.filesystem.target.files),
      directories: normalizeEntries(lab.filesystem.target.directories),
      symlinks: normalizeEntries(lab.filesystem.target.symlinks ?? [])
    }
  } else {
    target = {
      files: normalizeEntries(lab.files ?? []),
      directories: normalizeEntries(lab.directories ?? [])
    }
  }

  /** @type {FsScope} */
  let workstation = { files: [], directories: [], symlinks: [] }

  if (lab.filesystem?.workstation) {
    workstation = {
      files: normalizeEntries(lab.filesystem.workstation.files),
      directories: normalizeEntries(lab.filesystem.workstation.directories),
      symlinks: normalizeEntries(lab.filesystem.workstation.symlinks ?? [])
    }
  } else if (lab.workstation?.custom?.enabled) {
    workstation = {
      files: normalizeEntries(lab.workstation.custom.files ?? []),
      directories: normalizeEntries(lab.workstation.custom.directories ?? [])
    }
  }

  return { target, workstation, targetUser }
}

/**
 * Write canonical filesystem + legacy mirrors on lab object.
 * @param {object} lab
 */
export function syncFilesystemFields(lab) {
  const { target, workstation, targetUser } = normalizeLabFilesystem(lab)
  lab.filesystem = { target, workstation }
  lab.targetUser = targetUser
  lab.files = target.files
  lab.directories = target.directories
  if (lab.workstation?.custom) {
    lab.workstation.custom.files = workstation.files
    lab.workstation.custom.directories = workstation.directories
  }
  return lab
}

/**
 * @param {string} path
 * @param {ReturnType<typeof normalizeTargetUser>} targetUser
 */
export function validateFilesystemPath(path, targetUser) {
  if (!path || typeof path !== 'string') {
    return { ok: false, message: 'Path is required.' }
  }
  const p = path.trim()
  if (!p.startsWith('/') || p.includes('..')) {
    return { ok: false, message: 'Path must be absolute and cannot contain ..' }
  }

  const lower = p.toLowerCase()
  for (const bad of DANGEROUS_PATH_PREFIXES) {
    if (lower === bad || lower.startsWith(`${bad}/`)) {
      return { ok: false, message: `Blocked path: ${p} (${bad} is not allowed).` }
    }
  }

  if (lower.startsWith('/root') && targetUser.mode !== 'root') {
    return {
      ok: false,
      message: '/root paths require target login user mode "root" with allowRoot enabled.'
    }
  }

  const allowed =
    targetUser.mode === 'root'
      ? ALLOWED_PREFIXES_ROOT
      : ALLOWED_PREFIXES_NORMAL

  const okPrefix = allowed.some((prefix) => lower === prefix.replace(/\/$/, '') || lower.startsWith(prefix))
  if (!okPrefix) {
    return {
      ok: false,
      message: `Path ${p} is outside allowed lab directories. Use /home, /etc, /var, /opt, /srv, /tmp${targetUser.mode === 'root' ? ', or /root' : ''}.`
    }
  }

  return { ok: true }
}

/**
 * @param {object} lab
 * @param {{ developerMode?: boolean }} [options]
 */
export function scanFilesystemPaths(lab, options = {}) {
  const { target, workstation, targetUser } = normalizeLabFilesystem(lab)
  /** @type {{ severity: string, message: string }[]} */
  const issues = []

  const checkEntry = (entry, scope) => {
    const pathVal = entry.path ?? ''
    const check = validateFilesystemPath(pathVal, scope === 'workstation' ? { mode: 'generated-user', allowRoot: false } : targetUser)
    if (!check.ok) {
      issues.push({
        severity: options.developerMode ? 'warning' : 'blocked',
        message: `[${scope}] ${check.message}`
      })
    }
    if (entry.type === 'symlink') {
      const targetPath = entry.target ?? ''
      if (!targetPath.startsWith('/')) {
        issues.push({ severity: 'blocked', message: `[${scope}] Symlink target must be absolute.` })
      }
    }
  }

  for (const f of [...target.files, ...target.directories, ...(target.symlinks ?? [])]) {
    checkEntry(f, 'target')
  }
  for (const f of [...workstation.files, ...workstation.directories, ...(workstation.symlinks ?? [])]) {
    checkEntry(f, 'workstation')
  }

  if (targetUser.mode === 'root' && !targetUser.allowRoot) {
    issues.push({
      severity: 'blocked',
      message: 'targetUser.mode is root but allowRoot is not true.'
    })
  }

  return issues
}

/**
 * @param {FsEntry[]} files
 * @param {FsEntry[]} directories
 * @param {object} ctx
 * @param {{ redactSecrets?: boolean }} [opts]
 */
function renderPathsForTree(files, directories, ctx, opts = {}) {
  const paths = new Set()
  for (const d of directories) {
    const p = renderTemplateString(d.path ?? '', ctx, opts)
    if (p) paths.add(p.replace(/\/+$/, '') || '/')
  }
  for (const f of files) {
    const p = renderTemplateString(f.path ?? '', ctx, opts)
    if (p) paths.add(p)
  }
  return [...paths]
}

/**
 * @param {string[]} paths
 */
function buildTreeLines(paths) {
  if (!paths.length) return ['(empty)']

  /** @type {any} */
  const root = { children: {} }
  for (const full of paths.sort()) {
    const parts = full.replace(/^\//, '').split('/').filter(Boolean)
    let node = root
    let built = ''
    for (const part of parts) {
      built += `/${part}`
      if (!node.children[part]) {
        node.children[part] = { path: built, children: {}, isFile: false }
      }
      node = node.children[part]
    }
    node.isFile = !full.endsWith('/')
  }

  /** @type {string[]} */
  const lines = ['/']

  function walk(node, prefix) {
    const names = Object.keys(node.children).sort()
    names.forEach((name, idx) => {
      const child = node.children[name]
      const isLast = idx === names.length - 1
      const branch = isLast ? '└── ' : '├── '
      const ext = child.isFile ? '' : '/'
      lines.push(`${prefix}${branch}${name}${ext}`)
      const nextPrefix = prefix + (isLast ? '    ' : '│   ')
      if (!child.isFile && Object.keys(child.children).length) {
        walk(child, nextPrefix)
      }
    })
  }

  walk(root, '')
  return lines
}

/**
 * @param {object} lab
 * @param {{ username?: string, redactSecrets?: boolean }} [options]
 */
export function buildFilesystemTreePreview(lab, options = {}) {
  const { target, workstation, targetUser } = normalizeLabFilesystem(lab)
  const ctx = buildFilesystemTemplateContext({
    username: options.username ?? 'patchwolf42',
    labId: lab.id,
    targetUser
  })
  const renderOpts = { redactSecrets: options.redactSecrets !== false }

  const targetPaths = renderPathsForTree(target.files, target.directories, ctx, renderOpts)
  const workstationPaths = renderPathsForTree(
    workstation.files,
    workstation.directories,
    buildFilesystemTemplateContext({
      username: options.username ?? 'patchwolf42',
      labId: lab.id,
      targetUser: { mode: 'generated-user', allowRoot: false }
    }),
    renderOpts
  )

  return {
    targetUser,
    loginDirPreview: ctx.LOGIN_DIR,
    target: buildTreeLines(targetPaths),
    workstation: buildTreeLines(workstationPaths)
  }
}

/**
 * @param {object} lab
 */
export function targetManifestFromLab(lab) {
  const { target } = normalizeLabFilesystem(lab)
  return {
    version: 1,
    scope: 'target',
    files: target.files,
    directories: target.directories,
    symlinks: target.symlinks ?? []
  }
}

/**
 * @param {object} lab
 */
export function workstationManifestFromLab(lab) {
  const { workstation } = normalizeLabFilesystem(lab)
  return {
    version: 1,
    scope: 'workstation',
    files: workstation.files,
    directories: workstation.directories,
    symlinks: workstation.symlinks ?? []
  }
}

/**
 * @param {object} lab
 */
export function labUsesRuntimeFilesystem(lab) {
  const { target, workstation } = normalizeLabFilesystem(lab)
  const all = [...target.files, ...target.directories, ...(target.symlinks ?? []), ...workstation.files]
  return all.some((e) => inferFileStage(e) === 'runtime')
}

/**
 * Default file entry for login directory.
 * @param {'target' | 'workstation'} scope
 * @param {string} filename
 * @param {object} [lab]
 */
export function defaultLoginDirFile(scope, filename, lab) {
  const targetUser = normalizeTargetUser(lab ?? {})
  const owner = scope === 'workstation' ? '{{USERNAME}}' : '{{LOGIN_USER}}'
  return {
    path: `{{LOGIN_DIR}}/${filename}`,
    content: '',
    owner,
    group: owner,
    mode: '0644',
    stage: 'runtime'
  }
}
