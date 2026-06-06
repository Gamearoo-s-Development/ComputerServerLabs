/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @typedef {'docker-official' | 'microsoft-official' | 'verified-project' | 'community' | 'unverified' | 'local-build'} ImageTrustBadge */

/**
 * @param {string} imageRef
 * @returns {{ image: string, registry: string, publisher: string, badge: ImageTrustBadge, badgeLabel: string }}
 */
export function classifyDockerImageTrust(imageRef, options = {}) {
  if (options.localBuild === true) {
    return {
      image: imageRef || '(local build)',
      registry: 'local',
      publisher: 'You',
      badge: 'local-build',
      badgeLabel: 'Local Build Image'
    }
  }

  const image = String(imageRef ?? '').trim()
  if (!image) {
    return {
      image: '',
      registry: 'unknown',
      publisher: 'unknown',
      badge: 'unverified',
      badgeLabel: 'Unverified Image'
    }
  }

  const slash = image.includes('/') ? image.split('/') : [null, image]
  let registry = 'docker.io'
  let remainder = image

  if (slash.length >= 2 && (slash[0].includes('.') || slash[0] === 'localhost' || slash[0].includes(':'))) {
    registry = slash[0]
    remainder = slash.slice(1).join('/')
  }

  const parts = remainder.split('/')
  const namespace = parts.length >= 2 ? parts[0] : 'library'
  const repo = parts.length >= 2 ? parts.slice(1).join('/') : parts[0]
  const repoBase = repo.split(':')[0]

  /** @type {ImageTrustBadge} */
  let badge = 'community'
  let publisher = namespace

  const reg = registry.toLowerCase()
  const ns = namespace.toLowerCase()

  if (reg === 'mcr.microsoft.com' || reg.endsWith('.azurecr.io') && ns === 'windows') {
    badge = 'microsoft-official'
    publisher = 'Microsoft'
  } else if (reg === 'mcr.microsoft.com' || image.toLowerCase().startsWith('mcr.microsoft.com/')) {
    badge = 'microsoft-official'
    publisher = 'Microsoft'
  } else if (ns === 'library' || (!image.includes('/') && reg === 'docker.io')) {
    badge = 'docker-official'
    publisher = 'Docker Official Images'
  } else if (
    ['bitnami', 'hashicorp', 'grafana', 'prom', 'nginxinc', 'redhat', 'ubuntu', 'debian'].includes(ns)
  ) {
    badge = 'verified-project'
    publisher = namespace
  } else if (ns === 'local' || reg === 'localhost') {
    badge = 'unverified'
    publisher = namespace
  } else if (!image.includes('/') && reg === 'docker.io') {
    badge = 'docker-official'
    publisher = 'Docker Official Images'
  } else {
    badge = 'community'
    publisher = namespace
  }

  const badgeLabels = {
    'docker-official': 'Docker Official Image',
    'microsoft-official': 'Microsoft Official Image',
    'verified-project': 'Verified Project Image',
    community: 'Community Image',
    unverified: 'Unverified Image',
    'local-build': 'Local Build Image'
  }

  return {
    image,
    registry,
    publisher,
    repo: repoBase,
    badge,
    badgeLabel: badgeLabels[badge] ?? 'Unverified Image'
  }
}
