/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { LEGAL_EFFECTIVE_DATE, SITE_ABUSE_EMAIL, SITE_CONTACT_EMAIL, SITE_NAME, SITE_REPORT_EMAIL, SITE_URL } from '../lib/legalSite.js'

export const privacyPolicy = {
  title: 'Privacy Policy',
  effectiveDate: LEGAL_EFFECTIVE_DATE,
  intro: `${SITE_NAME} provides a free, open-source desktop application for hands-on system administration training and an optional online lab registry at ${SITE_URL}. This policy explains what we collect when you use the website, create an account, or connect the desktop app to our registry.`,
  sections: [
    {
      heading: 'Scope',
      paragraphs: [
        'The desktop application stores most learning progress locally on your computer. This policy primarily covers data handled by the website and registry API when you sign in, link a device, sync progress, browse or download labs, publish content, or receive email from us.',
        'If you self-host the registry or run the desktop app without linking an account, your operator or you control that data instead of the public service described here.'
      ]
    },
    {
      heading: 'Information we collect',
      list: [
        'Account details: email address, display name, and a hashed password when you register.',
        'Verification and security: email verification status, password-reset tokens, and security-related audit records.',
        'Device linking: short-lived device codes, optional device labels, and device identifiers used to authorize the desktop app.',
        'Progress sync (optional): XP, level, lab completion status, hints used, validation results, achievements, and related timestamps when you enable cloud sync.',
        'Leaderboard (optional): display name and aggregated stats when you opt in; you can keep your profile private or hidden from rankings.',
        'Lab catalog activity: lab metadata you publish, reviews, reports, download records, and version information for packs you upload or fetch.',
        'Email preferences: notification toggles for lab updates, completions, deployment notices, leaderboard milestones, and security alerts.',
        'Technical data: IP addresses and request metadata may appear in server logs, rate-limit records, and email delivery audit logs for abuse prevention and troubleshooting.'
      ]
    },
    {
      heading: 'Information we do not collect from the desktop app by default',
      paragraphs: [
        'Unless you link an account and turn on cloud sync, we do not receive your terminal commands, lab passwords, container filesystem contents, or local SQLite database from the desktop application.',
        'The app may contact the registry to browse or download lab packs; those requests may be logged in the ordinary course of operating the service.'
      ]
    },
    {
      heading: 'How we use information',
      list: [
        'Provide accounts, authentication, device linking, and optional progress sync.',
        'Operate the lab catalog, publishing workflow, downloads, reviews, and leaderboards.',
        'Send transactional email such as verification, password reset, and notification messages you have not unsubscribed from.',
        'Protect the service against abuse, spam, and suspicious lab submissions.',
        'Improve reliability and understand aggregate usage of the registry.'
      ]
    },
    {
      heading: 'Legal bases (where applicable)',
      paragraphs: [
        'Where privacy laws require a legal basis, we rely on performance of the service you request (account and sync features), legitimate interests in securing and operating the registry, and your consent for optional emails or leaderboard participation where consent is required.'
      ]
    },
    {
      heading: 'Cookies and local storage',
      paragraphs: [
        'The website stores access tokens in your browser local storage to keep you signed in. We do not use third-party advertising cookies on this site.',
        'Email unsubscribe and verification links use signed tokens in URLs rather than tracking cookies.'
      ]
    },
    {
      heading: 'Sharing and processors',
      paragraphs: [
        'We do not sell your personal information. We share data only with infrastructure and email providers needed to run the registry, when required by law, or to protect users and the service.',
        'Community lab packs may display a publisher display name or username you choose when publishing.'
      ]
    },
    {
      heading: 'Retention',
      paragraphs: [
        'We keep account and sync data while your account is active. Security, audit, and rate-limit logs are retained for a limited period appropriate for troubleshooting and abuse prevention.',
        'You may request account deletion by contacting us; some records may be kept where required for legal or security purposes.'
      ]
    },
    {
      heading: 'Your choices and rights',
      list: [
        'Use the desktop app without an account; local progress stays on your device.',
        'Manage notification preferences from account settings or unsubscribe links in email.',
        'Opt in or out of leaderboard visibility from your account or the desktop app.',
        'Request access, correction, or deletion of account data by emailing us.',
        'Withdraw consent for optional processing where consent applies, without affecting core account functions you still use.'
      ]
    },
    {
      heading: 'Children',
      paragraphs: [
        'The service is intended for learners who can responsibly use Docker-based training environments. We do not knowingly collect personal information from children under 13. Contact us if you believe a child has provided personal data.'
      ]
    },
    {
      heading: 'International users',
      paragraphs: [
        'If you access the service from outside the country where it is hosted, your information may be processed in that hosting location. We apply reasonable safeguards for cross-border transfers where required.'
      ]
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update this policy from time to time. We will post the revised version on this page and update the effective date. Continued use after changes means you accept the updated policy.'
      ]
    },
    {
      heading: 'Contact',
      paragraphs: [
        `Privacy questions: ${SITE_CONTACT_EMAIL}`,
        `Report suspicious labs or catalog content: ${SITE_REPORT_EMAIL}`,
        `Report abuse or illegal content: ${SITE_ABUSE_EMAIL}`
      ]
    }
  ]
}
