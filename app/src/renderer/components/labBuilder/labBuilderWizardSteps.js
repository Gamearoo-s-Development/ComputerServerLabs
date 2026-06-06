/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @type {{ id: string, label: string, description: string }[]} */
export const LAB_BUILDER_WIZARD_STEPS = [
  { id: 'basics', label: 'Basic Info', description: 'Title, id, difficulty, and learner-facing summary' },
  { id: 'runtime', label: 'Runtime / Containers', description: 'Single container or docker-compose layout' },
  { id: 'filesystem', label: 'Target Filesystem', description: 'Files, folders, and imports for the lab target' },
  { id: 'workstation', label: 'Workstation', description: 'Optional custom investigation workstation' },
  { id: 'services', label: 'Services & Ports', description: 'SSH, web, databases, and published routes' },
  { id: 'objectives', label: 'Objectives', description: 'Learner goals and auto-check rules' },
  { id: 'questions', label: 'Questions', description: 'Quiz and answer validation' },
  { id: 'hints', label: 'Hints', description: 'Progressive help for learners' },
  { id: 'ticket', label: 'Ticket / Scenario', description: 'Incident narrative and attachments' },
  { id: 'validation', label: 'Validation', description: 'Lab completion checks (container-only)' },
  { id: 'safety', label: 'Safety Review', description: 'Risk scan before export or test' },
  { id: 'preview', label: 'Generated Files', description: 'Dockerfile, compose, manifests, README' },
  { id: 'save', label: 'Save / Export', description: 'Export lab pack or run Docker test' }
]

export const LAB_BUILDER_WIZARD_STEP_IDS = LAB_BUILDER_WIZARD_STEPS.map((s) => s.id)
