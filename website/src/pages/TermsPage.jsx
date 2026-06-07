import React from 'react'
import LegalDocument from '../components/LegalDocument.jsx'
import { termsOfService } from '../content/termsOfService.js'

export default function TermsPage() {
  return <LegalDocument {...termsOfService} />
}
