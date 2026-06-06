/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

const VAR_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g

/**
 * @param {Record<string, string>} ctx
 * @param {{ redactSecrets?: boolean }} [options]
 */
export function renderTemplateString(input, ctx, options = {}) {
  if (input == null || typeof input !== 'string') return ''
  const redact = options.redactSecrets === true
  const secretKeys = new Set(['PASSWORD', 'FLAG_TEXT', 'FLAG_PATH'])

  return input.replace(VAR_PATTERN, (_match, key) => {
    const value = ctx[key] ?? `{{${key}}}`
    if (redact && secretKeys.has(key)) return '••••••••'
    return value
  })
}

/**
 * @param {string} text
 */
export function templateUsesVariables(text) {
  if (!text || typeof text !== 'string') return false
  return VAR_PATTERN.test(text)
}

/**
 * Infer file stage when omitted.
 * @param {{ path?: string, content?: string, stage?: string }} entry
 */
export function inferFileStage(entry) {
  if (entry.stage === 'build' || entry.stage === 'runtime') return entry.stage
  const blob = `${entry.path ?? ''}\n${entry.content ?? ''}`
  return templateUsesVariables(blob) ? 'runtime' : 'build'
}

/**
 * Build substitution context for preview (sample) or runtime (live env).
 * @param {{
 *   username?: string
 *   password?: string
 *   labId?: string
 *   sessionId?: string
 *   trainingFlag?: string
 *   flagBasename?: string
 *   flagPath?: string
 *   hostname?: string
 *   randomSeed?: string
 *   randomPort?: string
 *   targetHost?: string
 *   targetIp?: string
 *   targetSshPort?: string
 *   loginDir?: string
 *   loginUser?: string
 *   targetUser?: object
 * }} params
 */
export function buildTemplateContext(params) {
  const username = params.username ?? 'labuser'
  const loginDir = params.loginDir ?? `/home/${username}`
  const loginUser = params.loginUser ?? username

  return {
    USERNAME: username,
    PASSWORD: params.password ?? '(generated per session)',
    LAB_ID: params.labId ?? 'example-lab',
    SESSION_ID: params.sessionId ?? 'preview-session',
    FLAG_TEXT: params.trainingFlag ?? 'SGQ-PREVIEW-FLAG',
    FLAG_FILENAME: params.flagBasename ?? '.hidden_flag',
    FLAG_PATH: params.flagPath ?? '/home/labuser/.hidden_flag',
    HOSTNAME: params.hostname ?? 'lab-target',
    TARGET_HOST: params.targetHost ?? 'lab-target',
    TARGET_IP: params.targetIp ?? '172.20.0.2',
    TARGET_SSH_PORT: params.targetSshPort ?? '22',
    LOGIN_DIR: loginDir,
    LOGIN_USER: loginUser,
    RANDOM_PORT: params.randomPort ?? '32768',
    RANDOM_SEED: params.randomSeed ?? 'preview-seed'
  }
}

/**
 * @param {Record<string, string>} processEnv
 */
export function templateContextFromProcessEnv(processEnv) {
  const u = processEnv.SGQ_USERNAME ?? processEnv.LAB_USERNAME ?? 'labuser'
  const loginDir = processEnv.SGQ_LOGIN_DIR ?? processEnv.LOGIN_DIR ?? (u === 'root' ? '/root' : `/home/${u}`)
  const home = loginDir
  return buildTemplateContext({
    username: u,
    loginDir,
    loginUser: processEnv.SGQ_LOGIN_USER ?? processEnv.LOGIN_USER ?? u,
    password: processEnv.SGQ_PASSWORD ?? processEnv.LAB_PASSWORD ?? '',
    labId: processEnv.LAB_ID ?? processEnv.SGQ_LAB_ID ?? 'lab',
    sessionId: processEnv.SESSION_ID ?? processEnv.SGQ_SESSION_ID ?? '',
    trainingFlag: processEnv.LAB_TRAINING_FLAG ?? '',
    flagBasename: processEnv.LAB_FLAG_BASENAME ?? '.hidden_flag',
    flagPath: processEnv.LAB_FLAG_PATH ?? `${home}/.hidden_flag`,
    hostname: processEnv.HOSTNAME ?? 'lab-target',
    randomSeed: processEnv.LAB_SESSION_SEED ?? '',
    randomPort: processEnv.SGQ_RANDOM_PORT ?? '32768',
    targetHost: processEnv.TARGET_HOST ?? processEnv.SGQ_TARGET_HOST ?? 'lab-target',
    targetIp: processEnv.TARGET_IP ?? processEnv.SGQ_TARGET_INTERNAL_IP ?? '',
    targetSshPort: processEnv.TARGET_SSH_PORT ?? processEnv.SGQ_TARGET_SSH_PORT ?? '22'
  })
}
