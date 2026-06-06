#!/usr/bin/env node
/**
 * Smoke test: schema validation + discovery counts for the lab catalog.
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LABS_ROOT = path.join(__dirname, '..', 'app', 'labs')
const SKIP = new Set(['common', '_shared', 'bundled', 'community', '.git'])

/** @param {string} dir @returns {string[]} */
function listLabFolders(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .filter((e) => fs.existsSync(path.join(dir, e.name, 'lab.json')))
    .map((e) => e.name)
}

function discoverIds() {
  /** @type {{ id: string, source: string }[]} */
  const entries = []
  const priority = { bundled: 0, community: 1 }

  /** @param {string} labsRoot @param {string} source @param {boolean} bundled */
  function addFrom(labsRoot, source, bundled) {
    for (const folder of listLabFolders(labsRoot)) {
      const labJson = path.join(labsRoot, folder, 'lab.json')
      const data = JSON.parse(fs.readFileSync(labJson, 'utf8'))
      entries.push({ id: data.id ?? folder, source, bundled })
    }
  }

  for (const folder of listLabFolders(LABS_ROOT)) {
    if (SKIP.has(folder)) continue
    const labJson = path.join(LABS_ROOT, folder, 'lab.json')
    const data = JSON.parse(fs.readFileSync(labJson, 'utf8'))
    entries.push({ id: data.id ?? folder, source: 'bundled', bundled: true })
  }

  const bundledRoot = path.join(LABS_ROOT, 'bundled')
  if (fs.existsSync(bundledRoot)) {
    for (const track of fs.readdirSync(bundledRoot, { withFileTypes: true })) {
      if (!track.isDirectory() || track.name.startsWith('_')) continue
      addFrom(path.join(bundledRoot, track.name), 'bundled', true)
    }
  }

  const communityRoot = path.join(LABS_ROOT, 'community', 'examples')
  if (fs.existsSync(communityRoot)) {
    for (const track of fs.readdirSync(communityRoot, { withFileTypes: true })) {
      if (!track.isDirectory() || track.name === 'template') continue
      addFrom(path.join(communityRoot, track.name), 'community', false)
    }
  }

  /** @type {Map<string, { id: string, source: string, bundled: boolean }>} */
  const byId = new Map()
  for (const entry of entries) {
    const existing = byId.get(entry.id)
    if (!existing || priority[entry.source] < priority[existing.source]) {
      byId.set(entry.id, entry)
    }
  }

  return [...byId.values()]
}

const validate = spawnSync(process.execPath, [path.join(__dirname, 'validate-lab-catalog.mjs')], {
  stdio: 'inherit'
})
if (validate.status !== 0) {
  process.exit(validate.status ?? 1)
}

const discovered = discoverIds()
const bundled = discovered.filter((e) => e.bundled).length
const community = discovered.filter((e) => e.source === 'community').length

console.log(
  JSON.stringify(
    {
      discovered: discovered.length,
      bundled,
      community,
      minimumExpected: 100
    },
    null,
    2
  )
)

if (discovered.length < 100) {
  console.error(`Expected at least 100 discoverable labs, found ${discovered.length}`)
  process.exit(1)
}
