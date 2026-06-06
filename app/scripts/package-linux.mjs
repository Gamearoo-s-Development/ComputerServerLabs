#!/usr/bin/env node
/*
 * Linux packaging helper — AppImage/deb need Linux tools (mksquashfs, fakeroot).
 * On Windows, default to --dir (linux-unpacked only). Run full targets on Linux/WSL/CI.
 *
 * Set SKIP_APP_VITE_BUILD=1 to package existing app/out/ (used by WSL after Windows build).
 */

import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const outMain = path.join(appRoot, 'out', 'main', 'main.js')
const isWindows = process.platform === 'win32'

const releaseMode = process.argv.includes('--release')
const skipViteBuild =
  process.argv.includes('--skip-vite-build') ||
  process.env.SKIP_APP_VITE_BUILD === '1' ||
  process.env.SKIP_APP_VITE_BUILD === 'true'

const targetFlag = process.argv.find((arg) => arg.startsWith('--target='))
const target = targetFlag?.slice('--target='.length)

/** @type {string[]} */
const builderArgs = ['--linux', '--x64']

if (target) {
  builderArgs.push(`--config.linux.target=${target}`)
} else if (releaseMode || !isWindows) {
  // AppImage + deb from electron-builder.yml
} else {
  console.log(
    'Windows host: building linux-unpacked only (--dir). AppImage/deb need Linux or WSL — see docs/windows-build.md'
  )
  builderArgs.push('--dir')
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: appRoot, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (skipViteBuild) {
  if (!fs.existsSync(outMain)) {
    console.error('SKIP_APP_VITE_BUILD is set but app/out/main/main.js is missing.')
    console.error('Run on Windows first: npm run build:app')
    process.exit(1)
  }
  console.log('Skipping electron-vite build — using existing app/out/')
} else {
  run('npm', ['run', 'build'])
}

run('npx', ['electron-builder', ...builderArgs])
