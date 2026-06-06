#!/usr/bin/env node
/*
 * Build square app icons from the brand logo and copy to all packaging/dev paths.
 * Usage: node scripts/install-brand-icons.mjs [path/to/logo.png]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const ICON_SIZE = 512

const iconTargets = [
  'app/assets/icon.png',
  'app/resources/icon.png',
  'app/src/renderer/public/icon.png',
  'app/icon.png',
  'assets/icon.png',
  'resources/icon.png',
  'icon.png'
]

/**
 * @param {string} logoPath
 */
async function generateIcons(logoPath) {
  const sharp = (await import('sharp')).default
  const absLogo = path.isAbsolute(logoPath) ? logoPath : path.join(repoRoot, logoPath)
  if (!fs.existsSync(absLogo)) {
    throw new Error(`Logo not found: ${absLogo}`)
  }

  const iconBuffer = await sharp(absLogo)
    .ensureAlpha()
    .resize(ICON_SIZE, ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer()

  for (const rel of iconTargets) {
    const dest = path.join(repoRoot, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, iconBuffer)
    console.log('Wrote', rel)
  }

  const meta = await sharp(iconBuffer).metadata()
  console.log(`Icons ready (${meta.width}×${meta.height}) from ${path.relative(repoRoot, absLogo)}`)
}

const src =
  process.argv[2] ??
  (fs.existsSync(path.join(repoRoot, 'shared/branding/logo.png'))
    ? 'shared/branding/logo.png'
    : '')

if (!src) {
  console.error('Usage: node scripts/install-brand-icons.mjs [path-to-logo.png]')
  process.exit(1)
}

generateIcons(src).catch((err) => {
  if (String(err?.message ?? err).includes("Cannot find package 'sharp'")) {
    console.error('Install sharp first: npm install --save-dev sharp')
  } else {
    console.error(err)
  }
  process.exit(1)
})
