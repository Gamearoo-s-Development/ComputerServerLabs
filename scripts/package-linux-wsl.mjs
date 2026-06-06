#!/usr/bin/env node
/*
 * Run the full Linux release build inside WSL from Windows.
 * Produces AppImage (Steam Deck / universal) + deb (Ubuntu/Debian).
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

/** Distros that ship a normal userland (not Docker Desktop's minimal VM). */
const PREFERRED_DISTROS = [
  'Ubuntu',
  'Ubuntu-24.04',
  'Ubuntu-22.04',
  'Debian',
  'Fedora',
  'openSUSE-Leap',
  'kali-linux'
]

const SKIP_DISTROS = new Set(['docker-desktop', 'docker-desktop-data', 'podman-machine-default'])

if (process.platform !== 'win32') {
  console.error('Use: bash scripts/linux-package-release.sh')
  process.exit(1)
}

/**
 * `wsl -l` on Windows emits UTF-16 LE; reading as UTF-8 leaves null bytes in names.
 * @param {Buffer | undefined} buffer
 */
function decodeWslOutput(buffer) {
  if (!buffer?.length) return ''

  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString('utf16le', 2)
  }

  const nullCount = buffer.filter((byte) => byte === 0).length
  if (nullCount > buffer.length / 4) {
    return buffer.toString('utf16le')
  }

  return buffer.toString('utf8')
}

/**
 * @param {string} value
 */
function cleanWslText(value) {
  return String(value).replace(/\0/g, '').trim()
}

/**
 * @returns {string[]}
 */
function listWslDistros() {
  const result = spawnSync('wsl', ['-l', '-q'], { encoding: 'buffer' })
  if (result.status !== 0) return []

  return decodeWslOutput(result.stdout)
    .split(/\r?\n/)
    .map(cleanWslText)
    .filter(Boolean)
}

/**
 * @param {string[]} distros
 * @returns {string | null}
 */
function pickLinuxDistro(distros) {
  const usable = distros
    .map(cleanWslText)
    .filter((d) => d && !SKIP_DISTROS.has(d.toLowerCase()))
  if (!usable.length) return null

  for (const preferred of PREFERRED_DISTROS) {
    const match = usable.find((d) => d.toLowerCase() === preferred.toLowerCase())
    if (match) return match
  }

  return usable[0]
}

function toWslPath(winPath) {
  const normalized = path.resolve(winPath).replace(/\\/g, '/')
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (!match) return normalized
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`
}

const distros = listWslDistros()
const distro = pickLinuxDistro(distros)

if (!distro || distro.includes('\0')) {
  console.error('No usable WSL Linux distro found (docker-desktop cannot run bash).')
  console.error('')
  if (distros.length) {
    console.error('Detected distros:', distros.join(', '))
  }
  console.error('')
  console.error('Install Ubuntu from the Microsoft Store, then run:')
  console.error('  wsl --set-default Ubuntu')
  console.error('  npm run package:linux:wsl')
  console.error('')
  console.error('Or use GitHub Actions: workflow "Package Linux".')
  process.exit(1)
}

const wslRepo = toWslPath(repoRoot)

console.log('Step 1/2: Building app on Windows (electron-vite)…')
const winBuild = spawnSync('npm', ['--workspace', 'app', 'run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true
})
if (winBuild.status !== 0) {
  process.exit(winBuild.status ?? 1)
}

const bashCmd =
  `cd '${wslRepo}' && ` +
  `sed -i 's/\\r$//' scripts/linux-package-release.sh 2>/dev/null || true && ` +
  `bash scripts/linux-package-release.sh`

console.log('')
console.log(`Step 2/2: Packaging in WSL (${distro}) — AppImage + deb…`)
console.log(`  ${wslRepo}`)
console.log('')

const result = spawnSync('wsl', ['-d', distro, '-e', 'bash', '-lc', bashCmd], { stdio: 'inherit' })

if (result.status !== 0) {
  console.error('')
  console.error('WSL build failed. First-time setup in Ubuntu:')
  console.error('  wsl -d Ubuntu')
  console.error(
    '  sudo apt-get update && sudo apt-get install -y squashfs-tools fakeroot dpkg build-essential python3 curl'
  )
  console.error('  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -')
  console.error('  sudo apt-get install -y nodejs')
  console.error('  exit')
  console.error('  npm run package:linux:wsl')
}

process.exit(result.status ?? 1)
