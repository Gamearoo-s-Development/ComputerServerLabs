#!/usr/bin/env node
/*
 * Build square app icons from the brand logo mark (left glyph) for packaging + sidebar.
 * Usage: node scripts/install-brand-icons.mjs [path/to/logo.png]
 *
 * UI sidebar uses icon.png (mark only). logo.png stays the full wordmark — do not overwrite.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const ICON_SIZE = 512

/** Packaged app / electron-builder / taskbar */
const packagingIconTargets = [
  'app/assets/icon.png',
  'app/resources/icon.png',
  'app/icon.png',
  'assets/icon.png',
  'resources/icon.png',
  'icon.png'
]

/** In-app collapsed sidebar + favicon */
const uiIconTargets = ['app/src/renderer/public/icon.png']

/**
 * @param {string} logoPath
 */
async function generateMarkIcon(logoPath) {
  const sharp = (await import('sharp')).default
  const absLogo = path.isAbsolute(logoPath) ? logoPath : path.join(repoRoot, logoPath)
  if (!fs.existsSync(absLogo)) {
    throw new Error(`Logo not found: ${absLogo}`)
  }

  const meta = await sharp(absLogo).metadata()
  const height = meta.height ?? ICON_SIZE
  const width = meta.width ?? ICON_SIZE
  // Wordmark logo: hex/flask graphic is on the left — crop a square from the left edge.
  const cropWidth = Math.min(width, height)

  const iconBuffer = await sharp(absLogo)
    .extract({ left: 0, top: 0, width: cropWidth, height })
    .resize(ICON_SIZE, ICON_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9, quality: 100 })
    .toBuffer()

  for (const rel of [...packagingIconTargets, ...uiIconTargets]) {
    const dest = path.join(repoRoot, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, iconBuffer)
    console.log('Wrote', rel)
  }

  const outMeta = await sharp(iconBuffer).metadata()
  console.log(
    `Mark icon ready (${outMeta.width}×${outMeta.height}, cropped ${cropWidth}×${height}px from wordmark)`
  )
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

generateMarkIcon(src).catch((err) => {
  if (String(err?.message ?? err).includes("Cannot find package 'sharp'")) {
    console.error('Install sharp first: npm install --save-dev sharp')
  } else {
    console.error(err)
  }
  process.exit(1)
})
