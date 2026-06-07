import React from 'react'
import LegalDocument from '../components/LegalDocument.jsx'
import { privacyPolicy } from '../content/privacyPolicy.js'

export default function PrivacyPolicyPage() {
  return <LegalDocument {...privacyPolicy} />
}
