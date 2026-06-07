/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { LEGAL_EFFECTIVE_DATE, SITE_CONTACT_EMAIL, SITE_NAME, SITE_URL } from '../lib/legalSite.js'
import { LICENSE_NAME } from '../lib/siteConfig.js'

export const termsOfService = {
  title: 'Terms of Service',
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro: `These Terms of Service ("Terms") govern your use of ${SITE_NAME} at ${SITE_URL}, including the optional online lab registry and related account features. The desktop application is free, open-source software licensed separately under ${LICENSE_NAME}.`,
  sections: [
    {
      heading: 'Agreement',
      paragraphs: [
        'By creating an account, linking the desktop app, publishing labs, or otherwise using the online service, you agree to these Terms. If you do not agree, do not use the online features.',
        'You may use the desktop application under the MPL-2.0 license without creating an online account.'
      ]
    },
    {
      heading: 'The service',
      paragraphs: [
        `${SITE_NAME} provides hands-on system administration training through Docker-based labs in a desktop application. The website offers an optional catalog, account management, progress sync, leaderboards, and community lab publishing.`,
        'We may modify, suspend, or discontinue features with reasonable notice where practicable. The service is provided free of charge for standard use.'
      ]
    },
    {
      heading: 'Accounts and security',
      list: [
        'You must provide accurate account information and keep your credentials secure.',
        'You are responsible for activity under your account and for devices you link.',
        'You must be old enough to enter a binding agreement in your jurisdiction and to use Docker-based training environments responsibly.',
        'We may suspend or terminate accounts that violate these Terms or pose a security risk.'
      ]
    },
    {
      heading: 'Acceptable use',
      list: [
        'Do not attempt to break, overload, or circumvent security controls on the registry or other users\' accounts.',
        'Do not upload malware, exploit payloads, or lab packs designed to harm hosts when safety controls are bypassed.',
        'Do not harass other users, spam reviews, or publish misleading or infringing content.',
        'Do not scrape or automate access in a way that degrades the service for others.',
        'Do not use the service for unlawful purposes.'
      ]
    },
    {
      heading: 'Lab content and community packs',
      paragraphs: [
        'Official and verified lab packs are reviewed for basic safety before distribution. Community and unverified lab packs are provided by third-party authors and may not have the same level of review.',
        'You are responsible for reviewing lab files before running unverified or community content. Labs run in Docker containers with safety controls, but no training platform can eliminate all risk if you disable safeguards or run untrusted software outside those controls.',
        `${SITE_NAME} is not liable for damage caused by third-party lab packs or misuse of Docker on your machine.`
      ]
    },
    {
      heading: 'Publishing labs',
      list: [
        'You represent that you have the right to publish content you upload and that it does not violate others\' intellectual property or privacy rights.',
        'You grant us a license to host, distribute, and display your lab pack through the registry so other users can download and use it for training.',
        'We may remove, disable, or flag lab packs that appear malicious, violate these Terms, or receive credible abuse reports.',
        'Download counts, ratings, and metadata may be displayed publicly as part of the catalog.'
      ]
    },
    {
      heading: 'Intellectual property',
      paragraphs: [
        `The ${SITE_NAME} application source code is open source under ${LICENSE_NAME}. Lab packs may include their own licenses or terms set by the author; check each pack's documentation where provided.`,
        'The Computer Server Labs name, logo, and site design are our trademarks or those of our contributors. Do not imply endorsement without permission.'
      ]
    },
    {
      heading: 'Disclaimer of warranties',
      paragraphs: [
        'THE ONLINE SERVICE AND LAB CATALOG ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
        'Training scenarios simulate real administration tasks but are not a substitute for professional advice, production change control, or employer policies.'
      ]
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, COMPUTER SERVER LABS AND ITS CONTRIBUTORS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE, LAB PACKS, OR DESKTOP APPLICATION.',
        'OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE ONLINE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE MONTHS BEFORE THE CLAIM (TYPICALLY ZERO) OR (B) ONE HUNDRED U.S. DOLLARS (USD $100).'
      ]
    },
    {
      heading: 'Indemnity',
      paragraphs: [
        'You agree to indemnify and hold harmless Computer Server Labs and its contributors from claims arising out of content you publish, your misuse of the service, or your violation of these Terms or applicable law.'
      ]
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You may stop using the online service at any time and request account deletion. We may terminate or suspend access for violations of these Terms. Provisions that by nature should survive termination will survive.'
      ]
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update these Terms. Material changes will be posted on this page with an updated effective date. Continued use after changes constitutes acceptance.'
      ]
    },
    {
      heading: 'Contact',
      paragraphs: [`Questions about these Terms: ${SITE_CONTACT_EMAIL}`]
    }
  ]
}
