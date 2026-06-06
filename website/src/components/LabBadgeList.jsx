import React from 'react'
import { badgeClassName, getLabDisplayBadges } from '../lib/labBadges.js'

export default function LabBadgeList({ lab }) {
  const badges = getLabDisplayBadges(lab)
  if (!badges.length) return null

  return (
    <div className="lab-badges">
      {badges.map((b) => (
        <span key={b.key} className={badgeClassName(b.key)}>
          {b.label}
        </span>
      ))}
    </div>
  )
}
