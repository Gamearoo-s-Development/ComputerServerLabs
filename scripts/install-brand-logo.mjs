#!/usr/bin/env node
/*
 * Copy the brand logo into all standard asset locations and convert to transparent PNG.
 * Usage: node scripts/install-brand-logo.mjs path/to/logo.png
 */

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const src = process.argv[2] ? path.resolve(process.argv[2]) : ''
if (!src || !fs.existsSync(src)) {
  console.error('Usage: node scripts/install-brand-logo.mjs <path-to-logo.png>')
  process.exit(1)
}

const targets = [
  'prod/comingsoon/assets/logo.png',
  'shared/branding/logo.png',
  'app/src/renderer/public/logo.png',
  'website/public/logo.png'
]

for (const rel of targets) {
  const dest = path.join(repoRoot, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  console.log('Wrote', rel)
}

const convert = spawnSync(process.execPath, ['scripts/make-logo-transparent.mjs'], {
  cwd: repoRoot,
  stdio: 'inherit'
})
if (convert.status !== 0) {
  console.warn('Transparency step failed — run: npm install sharp --save-dev && node scripts/make-logo-transparent.mjs')
  process.exit(convert.status ?? 1)
}

const icons = spawnSync(process.execPath, ['scripts/install-brand-icons.mjs', path.join(repoRoot, 'shared/branding/logo.png')], {
  cwd: repoRoot,
  stdio: 'inherit'
})
if (icons.status !== 0) {
  console.warn('Icon step failed — run: npm install sharp --save-dev && node scripts/install-brand-icons.mjs')
  process.exit(icons.status ?? 1)
}

console.log('Done (transparent PNG, transparent margins trimmed, artwork preserved).')
console.log('App icons updated for packaging (app/assets/icon.png, etc.).')
console.log('Optional: node scripts/make-logo-transparent.mjs --enhance  (slight brighten for dark pages)')
