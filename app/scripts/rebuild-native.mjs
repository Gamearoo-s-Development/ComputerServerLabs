#!/usr/bin/env node
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Rebuild native addons for the pinned Electron version.
 * Prefers prebuilt binaries (no -f unless --force). Prints actionable errors on Windows.
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const NATIVE_MODULES = ['better-sqlite3', 'node-pty']
const DOCS_REL = 'docs/windows-build.md'

const forceRebuild = process.argv.includes('--force')

function readElectronVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const raw = pkg.devDependencies?.electron ?? pkg.dependencies?.electron
  if (!raw || typeof raw !== 'string') {
    throw new Error('Could not read electron version from package.json')
  }
  return raw.replace(/^[^\d]*/, '')
}

function hasSpacesInPath(dir) {
  return /\s/.test(dir)
}

function warnIfSpacesInPath() {
  if (!hasSpacesInPath(ROOT)) return
  console.warn(
    '\n[sysadmin-game] Warning: project path contains spaces:\n' +
      `  ${ROOT}\n` +
      '  node-gyp and MSVC builds are unreliable here. Clone to a short path, e.g. C:\\Dev\\SysAdminGame\n' +
      `  See ${DOCS_REL}\n`
  )
}

/**
 * @param {string} moduleName
 * @param {string} electronVersion
 */
function tryPrebuildInstall(moduleName, electronVersion) {
  const moduleDir = path.join(ROOT, 'node_modules', moduleName)
  if (!fs.existsSync(moduleDir)) {
    console.warn(`[sysadmin-game] Skip prebuild: ${moduleName} not installed`)
    return false
  }

  const prebuildBin = path.join(ROOT, 'node_modules', 'prebuild-install', 'bin.js')
  if (!fs.existsSync(prebuildBin)) {
    return false
  }

  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  console.log(`[sysadmin-game] Trying prebuilt binary for ${moduleName} (electron ${electronVersion}, ${arch})…`)

  const result = spawnSync(
    process.execPath,
    [prebuildBin, '--runtime', 'electron', '--target', electronVersion, '--arch', arch],
    { cwd: moduleDir, encoding: 'utf8', env: process.env }
  )

  if (result.status === 0) {
    console.log(`[sysadmin-game] Prebuilt binary OK for ${moduleName}`)
    return true
  }

  const err = (result.stderr || result.stdout || '').trim()
  if (err) {
    console.log(`[sysadmin-game] No prebuild for ${moduleName} (will compile if needed): ${err.split('\n')[0]}`)
  }
  return false
}

function runElectronRebuild() {
  const rebuildCli = path.join(ROOT, 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js')
  if (!fs.existsSync(rebuildCli)) {
    console.warn('[sysadmin-game] @electron/rebuild not installed — skip native rebuild')
    return 0
  }

  const args = [rebuildCli, '-w', NATIVE_MODULES.join(',')]
  if (forceRebuild) {
    args.push('-f')
  }

  console.log(
    `[sysadmin-game] Running electron-rebuild for: ${NATIVE_MODULES.join(', ')}` +
      (forceRebuild ? ' (forced)' : ' (prebuilds kept when present)')
  )

  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, npm_config_runtime: 'electron' },
    maxBuffer: 10 * 1024 * 1024
  })

  const combined = [result.stdout, result.stderr].filter(Boolean).join('\n')
  const logPath = path.join(ROOT, 'native-rebuild-last.log')
  if (combined) {
    fs.writeFileSync(logPath, combined, 'utf8')
  }

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  return { status: result.status ?? 1, combined }
}

/**
 * @param {string} output
 */
function formatNativeBuildFailure(output) {
  const text = output || ''
  const lines = [
    '',
    '═══════════════════════════════════════════════════════════════',
    '  Native module build failed',
    '═══════════════════════════════════════════════════════════════',
    '',
    '  Lab Terminal (node-pty) and SQLite need native addons compiled',
    '  for your Electron version.',
    ''
  ]

  if (/MSB8040|Spectre-mitigated/i.test(text)) {
    lines.push(
      '  Cause: Visual Studio is missing Spectre-mitigated C++ libraries (MSB8040).',
      '',
      '  Install via Visual Studio Installer → Modify → Individual components:',
      '    • MSVC v143 - VS 2022 C++ x64/x86 Spectre-mitigated libs (Latest)',
      '      (or MSVC v180 … Spectre-mitigated libs for VS 2026)',
      '    • Desktop development with C++ (workload)',
      '    • Windows 10/11 SDK',
      '    • Python 3 (for node-gyp)',
      ''
    )
  } else if (/space in the path/i.test(text) || hasSpacesInPath(ROOT)) {
    lines.push(
      '  Cause: node-gyp often fails when the repo path contains spaces.',
      `  Current path: ${ROOT}`,
      '  Recommended: C:\\Dev\\SysAdminGame',
      ''
    )
  } else {
    lines.push('  See the log above for compiler or node-gyp errors.', '')
  }

  lines.push(
    `  Full guide: ${DOCS_REL}`,
    '  After installing components, run:',
    '    npm run rebuild:native',
    '',
    '═══════════════════════════════════════════════════════════════',
    ''
  )
  return lines.join('\n')
}

function main() {
  warnIfSpacesInPath()
  const electronVersion = readElectronVersion()

  for (const name of NATIVE_MODULES) {
    tryPrebuildInstall(name, electronVersion)
  }

  const { status, combined } = runElectronRebuild()
  if (status === 0) {
    console.log('[sysadmin-game] Native modules ready for Electron', electronVersion)
    process.exit(0)
  }

  console.error(formatNativeBuildFailure(combined))
  process.exit(status)
}

main()
