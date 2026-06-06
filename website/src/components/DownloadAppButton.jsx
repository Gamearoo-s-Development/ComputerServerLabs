import React, { useEffect, useState } from 'react'
import { getDesktopDownloadUrlSync, resolveDesktopDownloadUrl } from '../lib/siteConfig.js'

export default function DownloadAppButton({ className = 'btn btn-sm' }) {
  const [url, setUrl] = useState(() => getDesktopDownloadUrlSync() ?? '')

  useEffect(() => {
    void resolveDesktopDownloadUrl().then((resolved) => {
      if (resolved) setUrl(resolved)
    })
  }, [])

  if (!url) return null

  return (
    <a className={className} href={url} target="_blank" rel="noopener noreferrer">
      Download app
    </a>
  )
}
