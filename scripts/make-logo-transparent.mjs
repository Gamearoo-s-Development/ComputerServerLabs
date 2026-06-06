#!/usr/bin/env node
/*
 * Convert brand logo to PNG with transparent background only (preserves artwork).
 * Usage:
 *   node scripts/make-logo-transparent.mjs [file.png ...]
 *   node scripts/make-logo-transparent.mjs --enhance [file.png ...]  # optional mild contrast for dark UIs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const defaultTargets = [
  'prod/comingsoon/assets/logo.png',
  'shared/branding/logo.png',
  'app/src/renderer/public/logo.png',
  'website/public/logo.png'
]

const argv = process.argv.slice(2)
const enhanceForDark = argv.includes('--enhance')
const inputs = argv.filter((a) => !a.startsWith('--'))

/** @param {number} r @param {number} g @param {number} b */
function isBackgroundPixel(r, g, b) {
  return r <= 24 && g <= 24 && b <= 24
}

/**
 * @param {string} filePath
 */
async function processLogo(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath)
  if (!fs.existsSync(abs)) {
    console.warn('Skip missing', filePath)
    return
  }

  let pipeline = sharp(abs).ensureAlpha()

  if (enhanceForDark) {
    pipeline = pipeline.modulate({ brightness: 1.06, saturation: 1.02 })
  }

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
  let cleared = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (isBackgroundPixel(r, g, b)) {
      data[i + 3] = 0
      cleared++
    }
  }

  let output = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })

  // Crop empty transparent margins so CSS height maps to visible artwork.
  try {
    output = output.trim({ threshold: 12 })
  } catch {
    // Uniform image — keep full canvas
  }

  const out = await output.png({ compressionLevel: 6, quality: 100 }).toBuffer()
  const trimmed = await sharp(out).metadata()

  const tmpPath = `${abs}.tmp`
  fs.writeFileSync(tmpPath, out)
  try {
    fs.rmSync(abs, { force: true })
    fs.renameSync(tmpPath, abs)
  } catch (err) {
    console.warn(
      `Could not replace ${path.relative(repoRoot, abs)} (${err instanceof Error ? err.message : err}). ` +
        `Wrote ${path.relative(repoRoot, tmpPath)}.`
    )
    return
  }
  const w = trimmed.width ?? info.width
  const h = trimmed.height ?? info.height
  console.log(
    `Updated ${path.relative(repoRoot, abs)} (${w}×${h}, ${cleared} background pixels cleared, trimmed)`
  )
}

const targets = inputs.length ? inputs : defaultTargets
for (const t of targets) {
  await processLogo(t)
}
