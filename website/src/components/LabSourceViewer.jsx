import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

/**
 * @param {{ labId: string }} props
 */
export default function LabSourceViewer({ labId }) {
  const [files, setFiles] = useState([])
  const [version, setVersion] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [selectedPath, setSelectedPath] = useState('')
  const [content, setContent] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingFile, setLoadingFile] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoadingList(true)
    setError('')
    setFiles([])
    setSelectedPath('')
    setContent('')
    api(`/api/labs/${encodeURIComponent(labId)}/source`)
      .then((res) => {
        const viewable = (res.files ?? []).filter((f) => f.viewable)
        setFiles(viewable)
        setVersion(res.version ?? '')
        setTruncated(Boolean(res.truncated))
        const preferred =
          viewable.find((f) => f.path === 'lab.json') ??
          viewable.find((f) => f.path.endsWith('/lab.json')) ??
          viewable[0]
        if (preferred) setSelectedPath(preferred.path)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingList(false))
  }, [labId])

  const loadFile = useCallback(
    async (filePath) => {
      if (!filePath) return
      setLoadingFile(true)
      setError('')
      try {
        const res = await api(
          `/api/labs/${encodeURIComponent(labId)}/source/file?path=${encodeURIComponent(filePath)}`
        )
        setContent(res.file?.content ?? '')
      } catch (e) {
        setContent('')
        setError(e.message)
      } finally {
        setLoadingFile(false)
      }
    },
    [labId]
  )

  useEffect(() => {
    if (selectedPath) void loadFile(selectedPath)
  }, [selectedPath, loadFile])

  if (loadingList) {
    return <p className="loading">Loading lab source…</p>
  }

  if (files.length === 0 && !error) {
    return <p className="text-muted">No viewable source files in this pack.</p>
  }

  return (
    <div className="lab-source">
      <div className="lab-source__header">
        <h3>Lab source</h3>
        <p className="text-muted">
          Full Docker build context for version {version || 'latest'} — includes shared <code>common/</code> scripts
          when the lab uses a labs-root build.
          {truncated ? ' Listing is truncated for large packs.' : ''}
        </p>
      </div>
      {error && !content ? <p className="text-danger">{error}</p> : null}
      <div className="lab-source__panes">
        <nav className="lab-source__tree" aria-label="Lab source files">
          <ul>
            {files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  className={`lab-source__file${selectedPath === file.path ? ' lab-source__file--active' : ''}`}
                  onClick={() => setSelectedPath(file.path)}
                  title={`${file.path} (${file.size} bytes)`}
                >
                  {file.path}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lab-source__viewer">
          <div className="lab-source__viewer-bar">
            <code>{selectedPath || 'Select a file'}</code>
            {loadingFile ? <span className="text-muted">Loading…</span> : null}
          </div>
          <pre className="lab-source__code">
            <code>{content || (loadingFile ? '' : '—')}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
