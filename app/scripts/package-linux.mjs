#!/usr/bin/env node
/*
 * Linux packaging helper — AppImage/deb need Linux tools (mksquashfs, fakeroot).
 * On Windows, default to --dir (linux-unpacked only). Run full targets on Linux/WSL/CI.
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const isWindows = process.platform === 'win32'

const releaseMode = process.argv.includes('--release')
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

run('npm', ['run', 'build'])
run('npx', ['electron-builder', ...builderArgs])
