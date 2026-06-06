#!/usr/bin/env node
/**
 * Validates all lab.json files under app/labs (smoke test for catalog generation).
 */
import fs from 'fs'
import path from 'path'
import Ajv from 'ajv'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LABS_ROOT = path.join(__dirname, '..', 'app', 'labs')
const SCHEMA_PATH = path.join(__dirname, '..', 'shared', 'lab-format', 'lab.schema.json')

const SKIP_DIRS = new Set(['common', '_shared', 'bundled', 'community', '.git'])

/** @param {string} dir @returns {string[]} */
function collectLabJsonFiles(dir) {
  /** @type {string[]} */
  const files = []
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    const labJson = path.join(full, 'lab.json')
    if (fs.existsSync(labJson)) {
      files.push(labJson)
    } else if (!SKIP_DIRS.has(entry.name)) {
      files.push(...collectLabJsonFiles(full))
    } else if (entry.name === 'bundled' || entry.name === 'community') {
      files.push(...collectLabJsonFiles(full))
    }
  }
  return files
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'))
const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

const files = collectLabJsonFiles(LABS_ROOT)
let valid = 0
let invalid = 0

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (validate(data)) {
    valid += 1
  } else {
    invalid += 1
    console.error('INVALID', path.relative(LABS_ROOT, file), validate.errors?.[0]?.message)
  }
}

console.log(JSON.stringify({ total: files.length, valid, invalid }, null, 2))
if (invalid > 0) process.exit(1)
