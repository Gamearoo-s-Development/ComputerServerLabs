/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { APP_NAME, APP_SHORT_NAME, APP_TAGLINE, WEBSITE_DOMAIN } from '@sysadmin-game/shared/branding/appBrand.js'

/** Player-facing UI copy — practical hands-on training tone. */
export const GAME_UI = {
  appName: APP_NAME,
  appShortName: APP_SHORT_NAME,
  appTagline: APP_TAGLINE,
  websiteDomain: WEBSITE_DOMAIN,

  // Navigation / pages
  mission: 'Lab',
  missions: 'Labs',
  missionBrowser: 'Lab Browser',
  missionTerminal: 'Lab Terminal',
  openMissionTerminal: 'Open Lab Terminal',
  labsNav: 'Labs',

  welcomeBlurb:
    'A community-built platform for practicing server, system, Docker, Linux, Windows, and troubleshooting skills — complete labs, earn XP, and track progress on your machine.',
  disclaimerTitle: 'Community Lab Disclaimer',
  disclaimerRequired: 'Please accept the Community Lab Disclaimer before starting labs.',

  // Objectives / validation
  missionObjectives: 'Lab Objectives',
  submitMission: 'Check',
  submitMissionChecking: 'Validating…',
  missionComplete: 'Lab Complete',

  // Learning / hints
  intel: 'Hints',
  revealIntel: 'Reveal hint',
  revealObjectiveHint: 'Reveal hint for this step',
  hintsUsedSummary: (used, total) =>
    total > 0 ? `${used}/${total} hints used` : 'No hints for this lab',
  commandCodex: 'Command Guide',
  playerProgress: 'Progress',
  xpGained: 'XP gained',
  systemScan: 'Health Checks',

  // Access / credentials (normal UI)
  connection: 'Credentials',
  workstationAccess: 'Workstation Access',
  workstationLoginTitle: 'Workstation Login',
  workstationUsername: 'Workstation Username',
  workstationPassword: 'Workstation Password',
  workstationAccessMethod: 'Access method',
  workstationLoginNote: 'Use these credentials if the desktop asks you to sign in.',
  workstationIdentityNote: 'Your workstation session uses the identity below.',
  workstationLoginGateIntro: 'Enter the workstation credentials to open the viewer or terminal.',
  workstationLoginGateSecurityNote:
    'This login only controls access to the simulated workstation viewer inside the app.',
  labTargetAccess: 'Lab Target Access',
  labTargetAccessNote: 'Use these credentials from the workstation.',
  host: 'Host',
  port: 'Port',
  username: 'Username',
  password: 'Password',
  missionCredentialsNote:
    'These credentials work only for this lab session. Do not reuse them elsewhere.',
  labSudoNote:
    'sudo is enabled for your lab user in this session (passwordless for training tasks). If a command still asks for a password, use the lab password above.',

  terminalWorkstationNote:
    'Click Open Lab Terminal to enter your isolated workstation. This opens a Linux container — you do not SSH into it from your PC.',
  desktopWorkstationNote:
    'Opens an isolated Windows desktop in Docker. The VM may take several minutes on first boot.',
  linuxDesktopWorkstationNote:
    'Opens an isolated Linux desktop in Docker/QEMU. First boot may take several minutes.',
  linuxDesktopTerminalNote:
    'Use the terminal inside the desktop workstation — do not use Open Lab Terminal unless this lab also provides terminal access.',
  workstationThenTargetNote:
    'From your workstation, SSH into the lab target using the Lab Target Access details below.',

  // SSH guidance (normal UI)
  useMissionTerminal:
    'Open the Lab Terminal for your isolated workstation, then connect to the lab target using the Lab Target Access details below.',

  labWorkstationBlurb:
    'This is an isolated lab workstation — not your PC. Admin tools run inside the container or VM only.',

  vmWorkstationConnectionBlurb:
    'Connect to the lab target from inside your VirtualBox VM using 10.0.2.2 and the host-published port below — not the Docker internal IP.',

  sshInternalNetworkHint:
    'Use the internal lab network address from the Lab Terminal workstation shell.',
  sshHostPublishedHint:
    'SSH is published on localhost — connect from your host with the command below.',

  availableLabServices: 'Available Lab Services',
  serviceRouteRefresh: 'Refresh status',
  serviceStatusStarting: 'Starting',
  serviceStatusOnline: 'Online',
  serviceStatusOffline: 'Offline',

  securitySimulationWarning:
    'These labs are for isolated practice environments only. Do not use these techniques on systems you do not own or have permission to test.',
  securityToolsWarning: 'Security tools are only for isolated labs.',
  discoverModeNote:
    'Credentials are not provided for this lab. Use the available services and clues to gain access.',
  discoverModeSshHint: 'SSH is part of the challenge. Discover valid access before connecting.',
  targetServicesTitle: 'Target Services',
  securitySimulationCategory: 'Security Simulation',

  // Terminal banner (shown inside the integrated terminal UI)
  terminalBannerTitle: `${APP_NAME} — Lab Terminal`,
  terminalBannerIsolation:
    'Isolated lab workstation — you are not on the lab target yet. Connect when ready.',
  terminalAccessCodes: 'Lab target credentials (for SSH)',
  terminalPanelClue: 'From this workstation shell, connect to the lab target:',
  terminalConnectHint: 'Use the host, port, username, and password from the lab connection panel.',

  // Connection routing / sandbox
  openMissionBrowser: 'Open Lab Browser',
  missionTarget: 'lab target',
  missionProgression: 'Lab progression',
  sandboxMissionEnv: 'Sandbox lab environment',

  // Copy used by other UI surfaces
  safetyLegalBlurb:
    'Community lab platform — play safely, and import labs only from sources you trust.'
}

export const DISCLAIMER_BULLETS = [
  'Computer Server Labs is a community-built learning platform for practicing server, system, Docker, Linux, Windows, and troubleshooting skills.',
  'Labs are community-created and may vary in accuracy, difficulty, realism, and quality.',
  'We are not trained, licensed, or accredited teachers, instructors, or education providers.',
  'The software is provided as-is with no warranty.',
  'You are responsible for your own system, files, data, and environment.',
  'Labs run in Docker containers and may use virtual machines in the future.',
  'Safety Mode helps reduce risk, but it cannot guarantee complete protection.',
  'Community-created labs may contain bugs, broken configs, misleading clues, unsafe assumptions, or experimental setups.',
  'Only import labs from sources you trust.',
  'Windows ISOs and other copyrighted materials are not included.',
  'This platform is intended for learning, experimentation, and isolated lab environments only.',
  'Developers and contributors are not responsible for data loss, system damage, Docker/VM issues, misconfiguration, resource usage, or third-party lab content.'
]

/** @deprecated Use missionProgression */
export const trainingProgression = GAME_UI.missionProgression
