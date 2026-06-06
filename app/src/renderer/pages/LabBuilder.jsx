/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNotifications } from '../context/NotificationContext.jsx'
import { useAppState } from '../context/AppStateContext.jsx'
import LabSessionPanel from '../components/labs/LabSessionPanel.jsx'
import { Button, Card, SectionTitle, StatusBadge } from '../components/ui/index.js'
import { getApi } from '../hooks/useApi.js'
import { cn } from '../utils/cn.js'
import { setLabFieldAtPath } from './labBuilderFormUtils.js'
import LabBuilderDockerPanel from '../components/labBuilder/LabBuilderDockerPanel.jsx'
import LabBuilderIncidentPanel from '../components/labBuilder/LabBuilderIncidentPanel.jsx'
import LabBuilderFilesystemPanel from '../components/labBuilder/LabBuilderFilesystemPanel.jsx'
import LabBuilderWizardNav from '../components/labBuilder/LabBuilderWizardNav.jsx'
import LabBuilderBasicsStep from '../components/labBuilder/LabBuilderBasicsStep.jsx'
import LabBuilderRuntimeStep from '../components/labBuilder/LabBuilderRuntimeStep.jsx'
import LabBuilderWorkstationStep from '../components/labBuilder/LabBuilderWorkstationStep.jsx'
import LabBuilderServicesStep from '../components/labBuilder/LabBuilderServicesStep.jsx'
import LabBuilderObjectivesStep from '../components/labBuilder/LabBuilderObjectivesStep.jsx'
import LabBuilderQuestionsStep from '../components/labBuilder/LabBuilderQuestionsStep.jsx'
import LabBuilderHintsStep from '../components/labBuilder/LabBuilderHintsStep.jsx'
import LabBuilderValidationStep from '../components/labBuilder/LabBuilderValidationStep.jsx'
import LabBuilderSafetyStep from '../components/labBuilder/LabBuilderSafetyStep.jsx'
import LabBuilderPreviewStep from '../components/labBuilder/LabBuilderPreviewStep.jsx'
import LabBuilderSaveExportStep from '../components/labBuilder/LabBuilderSaveExportStep.jsx'
import LabBuilderImportPanel from '../components/labBuilder/LabBuilderImportPanel.jsx'
import { LAB_BUILDER_WIZARD_STEPS } from '../components/labBuilder/labBuilderWizardSteps.js'

/** @param {string} raw */
function tryParseLab(raw) {
  try {
    return { ok: true, lab: JSON.parse(raw) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

/**
 * @param {{ onNavigate?: (id: string) => void }} props
 */
export default function LabBuilder({ onNavigate }) {
  const { notify } = useNotifications()
  const { loading, error: appLoadError, profile, dataDirectory } = useAppState()
  const api = getApi()

  const [drafts, setDrafts] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [wizardStep, setWizardStep] = useState('basics')
  const [working, setWorking] = useState(false)
  const [lastError, setLastError] = useState(null)

  const [lab, setLab] = useState(null)
  const [labJsonRaw, setLabJsonRaw] = useState('{}')
  const prevWizardStepRef = useRef('basics')
  const [dockerfile, setDockerfile] = useState('')
  const [entrypointSh, setEntrypointSh] = useState('')
  const [validateSh, setValidateSh] = useState('')
  const [readme, setReadme] = useState('')
  const [dockerComposeYaml, setDockerComposeYaml] = useState('')
  const [manifest, setManifest] = useState(null)
  const [scan, setScan] = useState(null)
  const [imageTrust, setImageTrust] = useState(null)

  const [dirty, setDirty] = useState(false)
  const [templates, setTemplates] = useState([])

  const [testSession, setTestSession] = useState(null)
  const [testLab, setTestLab] = useState(null)
  const [onlineLinked, setOnlineLinked] = useState(false)

  const parsed = useMemo(() => tryParseLab(labJsonRaw), [labJsonRaw])
  const formLab = lab ?? (parsed.ok ? parsed.lab : null)

  const [filesystemTreePreview, setFilesystemTreePreview] = useState(null)

  useEffect(() => {
    if (!formLab || wizardStep !== 'filesystem' || !api?.labBuilder?.previewLab) {
      return
    }
    void api.labBuilder
      .previewLab({ lab: formLab, dockerfile, entrypointSh, validateSh, readme })
      .then((res) => {
        if (res?.ok) setFilesystemTreePreview(res.data?.filesystemTree ?? null)
      })
  }, [formLab, wizardStep, api, dockerfile, entrypointSh, validateSh, readme])

  useEffect(() => {
    if (!formLab || !api?.labBuilder?.classifyDockerImage) {
      setImageTrust(null)
      return
    }
    const image = formLab.docker?.image ?? ''
    const localBuild =
      formLab.docker?.imageSource === 'local-build' || Boolean(formLab.docker?.buildPath)
    void api.labBuilder.classifyDockerImage({ image, localBuild }).then((r) => {
      if (r?.ok) setImageTrust(r.data)
      else setImageTrust(null)
    })
  }, [
    api,
    formLab?.docker?.image,
    formLab?.docker?.imageSource,
    formLab?.docker?.buildPath
  ])

  useEffect(() => {
    prevWizardStepRef.current = wizardStep
  }, [wizardStep])

  const wizardIndex = LAB_BUILDER_WIZARD_STEPS.findIndex((s) => s.id === wizardStep)
  const goWizardPrev = () => {
    if (wizardIndex > 0) setWizardStep(LAB_BUILDER_WIZARD_STEPS[wizardIndex - 1].id)
  }
  const goWizardNext = () => {
    if (wizardIndex < LAB_BUILDER_WIZARD_STEPS.length - 1) {
      setWizardStep(LAB_BUILDER_WIZARD_STEPS[wizardIndex + 1].id)
    }
  }

  const cannotCreateReason = useMemo(() => {
    if (loading) return 'Still loading app dataâ€¦'
    if (appLoadError) return appLoadError
    if (profile?.settings?.developerMode !== true) return 'Turn on Developer Mode in Settings.'
    if (!dataDirectory?.root) return 'App data folder path is not available yet.'
    return null
  }, [loading, appLoadError, profile?.settings?.developerMode, dataDirectory?.root])

  const canCreateDraft = cannotCreateReason === null

  const refreshList = useCallback(async () => {
    if (!api?.labBuilder?.listDrafts) return
    setLoadingList(true)
    setListError(null)
    try {
      const res = await api.labBuilder.listDrafts()
      if (!res?.ok) {
        const msg = res.error?.message ?? 'Could not load drafts.'
        setListError(msg)
        setLastError(msg)
        notify({ title: 'Draft list failed', body: msg, tone: 'danger' })
        return
      }
      setDrafts(res.data ?? [])
    } finally {
      setLoadingList(false)
    }
  }, [api, notify])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  useEffect(() => {
    if (!api?.labBuilder?.templateList) return
    void api.labBuilder.templateList().then((r) => {
      if (r?.ok && Array.isArray(r.data)) setTemplates(r.data)
    })
  }, [api])

  const loadDraft = useCallback(
    async (draftId) => {
      if (!api?.labBuilder?.getDraft) return
      setWorking(true)
      try {
        const res = await api.labBuilder.getDraft(draftId)
        if (!res?.ok) {
          const msg = res.error?.message ?? 'Unknown error'
          setLastError(msg)
          notify({ title: 'Load failed', body: msg, tone: 'danger' })
          return
        }
        const d = res.data
        setSelectedId(d.draftId)
        setLastError(null)
        const loadedLab = d.lab ?? tryParseLab(d.files?.labJsonRaw ?? '{}').lab ?? {}
        setLab(loadedLab)
        setLabJsonRaw(d.files?.labJsonRaw ?? JSON.stringify(loadedLab, null, 2))
        setDockerfile(d.files?.dockerfile ?? '')
        setEntrypointSh(d.files?.entrypointSh ?? '')
        setValidateSh(d.files?.validateSh ?? '')
        setReadme(d.files?.readme ?? '')
        setDockerComposeYaml(d.files?.dockerComposeYaml ?? '')
        setManifest(d.manifest ?? null)
        setDirty(false)
        setScan(d)
      } finally {
        setWorking(false)
      }
    },
    [api, notify]
  )

  useEffect(() => {
    if (drafts.length && !selectedId) {
      void loadDraft(drafts[0].id)
    }
  }, [drafts, selectedId, loadDraft])

  const saveDraft = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedId || !api?.labBuilder?.saveDraft) return
      const rawForSave = lab ? JSON.stringify(lab, null, 2) : labJsonRaw
      const saveParsed = tryParseLab(rawForSave)
      if (!saveParsed.ok) {
        if (!silent) notify({ title: 'Fix JSON', body: saveParsed.error, tone: 'warning' })
        return
      }
      setWorking(true)
      try {
        const res = await api.labBuilder.saveDraft(selectedId, {
          labJsonRaw: rawForSave,
          dockerfile,
          entrypointSh,
          validateSh,
          readme,
          dockerComposeYaml,
          manifest: manifest ?? {}
        })
        if (!res?.ok) {
          const msg = res.error?.message ?? 'Unknown error'
          setLastError(msg)
          if (!silent) {
            notify({ title: 'Save failed', body: msg, tone: 'danger' })
          } else {
            notify({ title: 'Autosave failed', body: msg, tone: 'danger' })
          }
          return
        }
        setLastError(null)
        setLab(saveParsed.lab)
        setLabJsonRaw(rawForSave)
        setManifest(res.data.manifest ?? manifest)
        setScan(res.data)
        setDirty(false)
        if (!silent) void refreshList()
        if (!silent) notify({ title: 'Draft saved', body: res.data?.lab?.title ?? selectedId, tone: 'success' })
      } finally {
        setWorking(false)
      }
    },
    [
      selectedId,
      api,
      lab,
      labJsonRaw,
      dockerfile,
      entrypointSh,
      validateSh,
      readme,
      dockerComposeYaml,
      manifest,
      notify,
      refreshList
    ]
  )

  useEffect(() => {
    if (!dirty || !selectedId || !formLab) return
    const timer = window.setTimeout(() => {
      void saveDraft({ silent: true })
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [
    dirty,
    selectedId,
    formLab,
    labJsonRaw,
    dockerfile,
    entrypointSh,
    validateSh,
    readme,
    dockerComposeYaml,
    saveDraft
  ])

  function markDirty() {
    setDirty(true)
  }

  function applyLabUpdate(nextLab) {
    setLab(nextLab)
    setLabJsonRaw(JSON.stringify(nextLab, null, 2))
    markDirty()
  }

  function currentLabBase() {
    if (lab) return lab
    const r = tryParseLab(labJsonRaw)
    return r.ok ? r.lab : null
  }

  function patchLabField(path, value) {
    const base = currentLabBase()
    if (!base) {
      notify({ title: 'Invalid lab.json', body: 'Fix JSON in the lab.json tab first.', tone: 'warning' })
      return
    }
    applyLabUpdate(setLabFieldAtPath(base, path, value))
  }

  function patchWorkstation(partial) {
    const base = currentLabBase()
    if (!base) {
      notify({ title: 'Invalid lab.json', body: 'Fix JSON in the lab.json tab first.', tone: 'warning' })
      return
    }
    const next = { ...base }
    next.workstation = {
      recommended: 'ubuntu-terminal',
      supported: ['ubuntu-terminal', 'debian-terminal'],
      required: false,
      reason: '',
      ...(next.workstation ?? {}),
      ...partial
    }
    applyLabUpdate(next)
  }

  function patchUnlockRequirements(partial) {
    const base = currentLabBase()
    if (!base) {
      notify({ title: 'Invalid lab.json', body: 'Fix JSON in the lab.json tab first.', tone: 'warning' })
      return
    }
    const next = { ...base }
    next.unlockRequirements = {
      minLevel: 1,
      requiredLabs: [],
      requiredAchievements: [],
      recommendedSkills: [],
      ...(next.unlockRequirements ?? {}),
      ...partial
    }
    applyLabUpdate(next)
  }

  function patchVariation(partial) {
    const base = currentLabBase()
    if (!base) {
      notify({ title: 'Invalid lab.json', body: 'Fix JSON in the lab.json tab first.', tone: 'warning' })
      return
    }
    const next = { ...base }
    next.variation = { ...(next.variation ?? { enabled: true }), ...partial }
    applyLabUpdate(next)
  }

  function patchCommandGuide(partial) {
    const base = currentLabBase()
    if (!base) {
      notify({ title: 'Invalid lab.json', body: 'Fix JSON in the lab.json tab first.', tone: 'warning' })
      return
    }
    const next = { ...base }
    next.commandGuide = { ...(next.commandGuide ?? {}), ...partial }
    applyLabUpdate(next)
  }

  function patchRedHerringsRaw(raw) {
    const base = currentLabBase()
    if (!base) {
      notify({ title: 'Invalid lab.json', body: 'Fix JSON in the lab.json tab first.', tone: 'warning' })
      return
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      notify({ title: 'Invalid JSON', body: 'Red herrings must be a JSON array.', tone: 'warning' })
      return
    }
    applyLabUpdate({ ...base, redHerrings: parsed })
  }

  async function handleNew() {
    if (!canCreateDraft) {
      notify({
        title: 'Cannot create draft',
        body: cannotCreateReason ?? 'Unavailable.',
        tone: 'danger'
      })
      return
    }
    setLastError(null)
    setWorking(true)
    try {
      const res = await api.labBuilder.createDraft({})
      if (!res?.ok) {
        const msg =
          res.error?.message ??
          'Could not create lab draft. Check app data folder permissions.'
        setLastError(msg)
        notify({ title: 'Create draft failed', body: msg, tone: 'danger' })
        return
      }
      await refreshList()
      await loadDraft(res.data.draftId)
      notify({ title: 'Draft created', body: res.data.lab?.title ?? 'New Docker Lab', tone: 'success' })
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete() {
    if (!selectedId) return
    if (!window.confirm('Delete this draft permanently?')) return
    setWorking(true)
    try {
      const res = await api.labBuilder.deleteDraft(selectedId)
      if (!res?.ok) {
        notify({ title: 'Delete failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      setSelectedId(null)
      setTestSession(null)
      setTestLab(null)
      await refreshList()
      notify({ title: 'Draft deleted', tone: 'info' })
    } finally {
      setWorking(false)
    }
  }

  async function handleDuplicate() {
    if (!selectedId) return
    const newId = window.prompt('New lab id (optional, e.g. my-lab-002)', '')
    if (newId === null) return
    setWorking(true)
    try {
      const res = await api.labBuilder.duplicateDraft(selectedId, newId?.trim() || undefined)
      if (!res?.ok) {
        notify({ title: 'Duplicate failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      await refreshList()
      await loadDraft(res.data.draftId)
      notify({ title: 'Draft duplicated', tone: 'success' })
    } finally {
      setWorking(false)
    }
  }

  async function handleImport() {
    const confirmed = window.confirm(
      'Only import labs from trusted sources.\n\nImported labs may contain unsafe scripts, unstable configurations, or excessive resource usage.\n\nContinue?'
    )
    if (!confirmed) return
    setWorking(true)
    try {
      const res = await api.labBuilder.importLabFolder()
      if (!res?.ok) {
        if (res.error?.code !== 'CANCELLED') {
          notify({ title: 'Import failed', body: res.error?.message ?? '', tone: 'danger' })
        }
        return
      }
      await refreshList()
      await loadDraft(res.data.draftId)
      notify({ title: 'Imported', tone: 'success' })
    } finally {
      setWorking(false)
    }
  }

  useEffect(() => {
    void api?.online?.getStatus?.().then((res) => {
      if (res?.ok && res.data) setOnlineLinked(res.data.linked === true)
    })
  }, [api])

  async function handlePublish() {
    if (!selectedId) return
    setWorking(true)
    try {
      const res = await api.labBuilder.publishDraft({ draftId: selectedId })
      if (!res?.ok) {
        notify({ title: 'Publish failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      notify({
        title: 'Published to registry',
        body: `${res.data?.labId} v${res.data?.version} — community / unverified until reviewed`,
        tone: 'success'
      })
    } finally {
      setWorking(false)
    }
  }

  async function handleExport(format) {
    if (!selectedId) return
    setWorking(true)
    try {
      const res = await api.labBuilder.exportDraft({ draftId: selectedId, format })
      if (!res?.ok) {
        if (res.error?.code !== 'CANCELLED') {
          notify({ title: 'Export failed', body: res.error?.message ?? '', tone: 'danger' })
        }
        return
      }
      notify({ title: 'Exported', body: res.data?.path ?? '', tone: 'success' })
    } finally {
      setWorking(false)
    }
  }

  async function handleApplyTemplate(presetKey) {
    if (!selectedId || !presetKey) return
    setWorking(true)
    try {
      const res = await api.labBuilder.applyTemplate(selectedId, presetKey)
      if (!res?.ok) {
        notify({ title: 'Template failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      await loadDraft(selectedId)
      notify({ title: 'Template applied', tone: 'success' })
    } finally {
      setWorking(false)
    }
  }

  async function handleRegenReadme() {
    if (!selectedId) return
    setWorking(true)
    try {
      const res = await api.labBuilder.generateReadme(selectedId)
      if (!res?.ok) {
        notify({ title: 'README failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      await loadDraft(selectedId)
      notify({ title: 'README regenerated', tone: 'success' })
    } finally {
      setWorking(false)
    }
  }

  async function handleValidate() {
    if (!selectedId) return
    setWorking(true)
    try {
      if (dirty && parsed.ok) await saveDraft({ silent: true })
      const res = await api.labBuilder.validateDraft(selectedId)
      if (!res?.ok) {
        notify({ title: 'Validate failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      const d = res.data
      setScan(d)
      notify({
        title: d.schemaValid ? 'Schema OK' : 'Schema issues',
        body: d.schemaValid ? 'Safety scan updated.' : (d.schemaErrors ?? []).join('; ') || 'See panel',
        tone: d.schemaValid ? 'success' : 'warning'
      })
    } finally {
      setWorking(false)
    }
  }

  async function handleBuildTest() {
    if (!selectedId) return
    if (!parsed.ok) {
      notify({ title: 'Fix lab.json', body: parsed.error, tone: 'warning' })
      return
    }
    if (dirty) await saveDraft({ silent: true })
    setWorking(true)
    try {
      const res = await api.labBuilder.buildTestDraft(selectedId)
      if (!res?.ok) {
        notify({ title: 'Build/Test failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      const s = res.data
      setTestSession({
        sessionId: s.sessionId,
        labId: s.labId,
        containerName: s.containerName,
        containerId: s.containerId,
        status: s.status ?? 'running',
        ports: s.ports ?? [],
        credentials: s.credentials,
        image: s.image,
        startedAt: new Date().toISOString(),
        builderTest: true,
        message: s.message,
        objectives: []
      })
      const pr = tryParseLab(labJsonRaw)
      setTestLab(pr.ok ? pr.lab : {})
      notify({ title: 'Builder test started', body: 'No XP is awarded for validations here.', tone: 'info' })
    } finally {
      setWorking(false)
    }
  }

  async function handleStopTest() {
    if (!testSession?.sessionId) return
    setWorking(true)
    try {
      const res = await api.labBuilder.stopTestSession(testSession.sessionId)
      if (!res?.ok) {
        notify({ title: 'Stop failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      setTestSession(null)
      setTestLab(null)
      notify({ title: 'Test session stopped', tone: 'info' })
    } finally {
      setWorking(false)
    }
  }

  async function handleResetTest() {
    if (!testSession?.sessionId || !api?.labs?.reset) return
    setWorking(true)
    try {
      const res = await api.labs.reset(testSession.sessionId)
      if (!res?.ok) {
        notify({ title: 'Reset failed', body: res.error?.message ?? '', tone: 'danger' })
        return
      }
      const s = res.data
      setTestSession((prev) =>
        prev
          ? {
              ...prev,
              ...s,
              ports: s.ports ?? prev.ports,
              credentials: s.credentials ?? prev.credentials,
              builderTest: true,
              message: s.message ?? prev.message
            }
          : null
      )
    } finally {
      setWorking(false)
    }
  }

  const refreshScan = useCallback(async () => {
    if (!selectedId || !api?.labBuilder?.getDraft) return
    setWorking(true)
    try {
      if (dirty && parsed.ok) await saveDraft({ silent: true })
      const res = await api.labBuilder.getDraft(selectedId)
      if (res?.ok) setScan(res.data)
    } finally {
      setWorking(false)
    }
  }, [selectedId, api, dirty, parsed.ok, saveDraft])

  useEffect(() => {
    if (!selectedId) setScan(null)
  }, [selectedId])

  return (
    <div className="mx-auto max-w-6xl animate-fade-in">
      <SectionTitle
        title="Lab Builder"
        description="Drafts live under userData Â· lab-builder Â· drafts â€” not in the bundled catalog."
      />

      {lastError ? (
        <div
          className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {lastError}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canCreateDraft}
          title={cannotCreateReason ?? undefined}
          onClick={() => void handleNew()}
        >
          New Lab
        </Button>
        <Button variant="secondary" size="sm" disabled={working} onClick={() => void handleImport()}>
          Import folder
        </Button>
        <Button variant="secondary" size="sm" disabled={!selectedId || working} onClick={() => void handleExport('zip')}>
          Export zip
        </Button>
        <Button variant="secondary" size="sm" disabled={!selectedId || working} onClick={() => void handleExport('folder')}>
          Export folder
        </Button>
        <Button variant="secondary" size="sm" disabled={!selectedId || working} onClick={() => void handleDuplicate()}>
          Duplicate
        </Button>
        <Button variant="ghost" size="sm" disabled={!selectedId || working} onClick={() => void handleDelete()}>
          Delete
        </Button>
        {onNavigate ? (
          <Button variant="ghost" size="sm" onClick={() => onNavigate('settings')}>
            Settings
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[14rem,minmax(0,1fr)]">
        <Card className="h-fit">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-dim">Drafts</h3>
          {listError ? (
            <p className="mt-2 text-xs text-danger" role="status">
              {listError}
            </p>
          ) : null}
          <ul className="mt-2 max-h-[50vh] space-y-1 overflow-auto text-sm">
            {loadingList ? (
              <li className="text-muted">Loadingâ€¦</li>
            ) : drafts.length === 0 ? (
              <li className="text-muted">No drafts yet.</li>
            ) : (
              drafts.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => void loadDraft(d.id)}
                    className={cn(
                      'w-full rounded-lg px-2 py-1.5 text-left transition-colors',
                      selectedId === d.id ? 'bg-accent/15 text-accent' : 'hover:bg-card text-gray-300'
                    )}
                  >
                    <span className="line-clamp-2 font-medium">{d.title}</span>
                    <span className="block font-mono text-[10px] text-muted-dim">{d.labId}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>

        <div className="min-w-0 space-y-4">
          {testSession && testLab ? (
            <LabSessionPanel
              session={testSession}
              lab={{
                ...testLab,
                title: testLab.title ?? 'Draft lab',
                description: testLab.description ?? '',
                xpReward: testLab.xpReward ?? 0,
                validationType: testLab.validation?.type
              }}
              onClose={() => {
                setTestSession(null)
                setTestLab(null)
              }}
              onStop={() => void handleStopTest()}
              onReset={() => void handleResetTest()}
              onComplete={() => {
                setTestSession(null)
                setTestLab(null)
                notify({
                  title: 'Builder test complete',
                  body: 'Container removed â€” no XP or catalog progress.',
                  tone: 'success'
                })
              }}
            />
          ) : null}

          {!selectedId ? (
            <Card>
              <p className="text-sm text-muted">Select or create a draft to begin editing.</p>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" disabled={working || !formLab} onClick={() => void saveDraft({})}>
                  Save
                </Button>
                <Button variant="secondary" size="sm" disabled={working} onClick={() => void handleValidate()}>
                  Re-validate schema
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={working || !formLab || scan?.schemaValid !== true}
                  onClick={() => void handleBuildTest()}
                  title={
                    scan?.schemaValid !== true
                      ? 'Complete strict checklist in the panel (Docker image, ports, tasks, Dockerfile for build) before Docker Build/Test.'
                      : 'Unsaved edits are saved automatically before the container starts.'
                  }
                >
                  Build/Test (Docker)
                </Button>
                <Button variant="ghost" size="sm" disabled={working || !testSession} onClick={() => void handleStopTest()}>
                  Stop test
                </Button>
                <select
                  className="rounded-lg border border-border bg-background-elevated px-2 py-1.5 text-xs text-gray-200"
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value
                    e.target.value = ''
                    if (v) void handleApplyTemplate(v)
                  }}
                >
                  <option value="">Apply Docker templateâ€¦</option>
                  {templates.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" disabled={working} onClick={() => void handleRegenReadme()}>
                  Regenerate README
                </Button>
                {dirty ? <StatusBadge label="Edited" value="unsaved" variant="warning" /> : null}
                {parsed.ok ? null : (
                  <StatusBadge label="JSON" value="invalid" variant="danger" />
                )}
              </div>

              <LabBuilderWizardNav
                step={wizardStep}
                onStepChange={setWizardStep}
                onPrev={goWizardPrev}
                onNext={goWizardNext}
              />

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),18rem]">
                <Card className="min-h-[420px]">
                  {wizardStep === 'basics' && formLab ? (
                    <LabBuilderBasicsStep
                      formLab={formLab}
                      patchLabField={patchLabField}
                      patchUnlockRequirements={patchUnlockRequirements}
                    />
                  ) : null}

                  {wizardStep === 'runtime' && formLab ? (
                    <LabBuilderRuntimeStep formLab={formLab} applyLabUpdate={applyLabUpdate}>
                      <LabBuilderDockerPanel
                        formLab={formLab}
                        applyLabUpdate={applyLabUpdate}
                        imageTrust={imageTrust}
                        developerMode={profile?.settings?.developerMode === true}
                        scan={scan}
                        api={api}
                        selectedId={selectedId}
                        dockerfile={dockerfile}
                        entrypointSh={entrypointSh}
                        validateSh={validateSh}
                        readme={readme}
                      />
                    </LabBuilderRuntimeStep>
                  ) : null}

                  {wizardStep === 'filesystem' && formLab ? (
                    <div className="space-y-4">
                      <LabBuilderImportPanel
                        draftId={selectedId}
                        formLab={formLab}
                        applyLabUpdate={applyLabUpdate}
                        onImported={() => void loadDraft(selectedId)}
                      />
                      <LabBuilderFilesystemPanel
                        formLab={formLab}
                        applyLabUpdate={applyLabUpdate}
                        treePreview={filesystemTreePreview}
                      />
                    </div>
                  ) : null}

                  {wizardStep === 'workstation' && formLab ? (
                    <LabBuilderWorkstationStep
                      formLab={formLab}
                      applyLabUpdate={applyLabUpdate}
                      patchWorkstation={patchWorkstation}
                    />
                  ) : null}

                  {wizardStep === 'services' && formLab ? (
                    <LabBuilderServicesStep formLab={formLab} applyLabUpdate={applyLabUpdate} />
                  ) : null}

                  {wizardStep === 'objectives' && formLab ? (
                    <LabBuilderObjectivesStep formLab={formLab} patchLabField={patchLabField} />
                  ) : null}

                  {wizardStep === 'questions' && formLab ? (
                    <LabBuilderQuestionsStep formLab={formLab} patchLabField={patchLabField} />
                  ) : null}

                  {wizardStep === 'hints' && formLab ? (
                    <LabBuilderHintsStep formLab={formLab} patchLabField={patchLabField} />
                  ) : null}

                  {wizardStep === 'ticket' && formLab ? (
                    <LabBuilderIncidentPanel formLab={formLab} applyLabUpdate={applyLabUpdate} />
                  ) : null}

                  {wizardStep === 'validation' && formLab ? (
                    <LabBuilderValidationStep
                      formLab={formLab}
                      patchLabField={patchLabField}
                      validateSh={validateSh}
                      setValidateSh={setValidateSh}
                      markDirty={markDirty}
                    />
                  ) : null}

                  {wizardStep === 'safety' ? (
                    <LabBuilderSafetyStep
                      scan={scan}
                      working={working}
                      onRefresh={() => void refreshScan()}
                    />
                  ) : null}

                  {wizardStep === 'preview' && formLab ? (
                    <>
                      <LabBuilderPreviewStep
                        formLab={formLab}
                        dockerfile={dockerfile}
                        entrypointSh={entrypointSh}
                        validateSh={validateSh}
                        readme={readme}
                        dockerComposeYaml={dockerComposeYaml}
                        developerMode={profile?.settings?.developerMode === true}
                        labJsonRaw={labJsonRaw}
                        onLabJsonChange={(v) => {
                          setLabJsonRaw(v)
                          markDirty()
                        }}
                        onDockerfileChange={(v) => {
                          setDockerfile(v)
                          markDirty()
                        }}
                        onEntrypointChange={(v) => {
                          setEntrypointSh(v)
                          markDirty()
                        }}
                      />
                    </>
                  ) : null}

                  {wizardStep === 'save' ? (
                    <LabBuilderSaveExportStep
                      onSave={() => void saveDraft({})}
                      onExportFolder={() => void handleExport('folder')}
                      onExportZip={() => void handleExport('zip')}
                      onPublishToRegistry={() => void handlePublish()}
                      onBuildTest={() => void handleBuildTest()}
                      working={working}
                      scan={scan}
                      onlineLinked={onlineLinked}
                    />
                  ) : null}

                  {wizardStep === 'basics' && !parsed.ok ? (
                    <p className="mt-4 text-sm text-danger">Fix lab.json â€” {parsed.error}</p>
                  ) : null}


                </Card>

                <Card className="h-fit lg:sticky lg:top-4">
                  <h3 className="text-xs font-semibold uppercase text-muted-dim">
                    Strict (export / Docker Build/Test)
                  </h3>
                  {scan ? (
                    scan.schemaValid ? (
                      <p className="mt-2 text-sm text-success">Passes catalog schema validation.</p>
                    ) : (
                      <ul className="mt-2 list-inside list-disc text-xs text-warning">
                        {(scan.schemaErrors ?? []).map((err, i) => (
                          <li key={i}>{String(err)}</li>
                        ))}
                      </ul>
                    )
                  ) : (
                    <p className="mt-2 text-xs text-muted">Open or refresh a draft to scan.</p>
                  )}

                  <h3 className="mt-4 text-xs font-semibold uppercase text-muted-dim">Draft notes</h3>
                  <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-[11px] text-muted">
                    {Array.isArray(scan?.draftWarnings) && scan.draftWarnings.length ? (
                      scan.draftWarnings.map((w, i) => (
                        <li key={i} className="rounded border border-border/60 px-2 py-1">
                          {String(w)}
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-dim">No extra draft warnings.</li>
                    )}
                  </ul>

                  <h3 className="mt-4 text-xs font-semibold uppercase text-muted-dim">Safety scan</h3>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-[11px]">
                    {!scan?.safety?.issues?.length ? (
                      <li className="text-muted">No issues reported.</li>
                    ) : (
                      scan.safety.issues.map((issue, i) => (
                        <li
                          key={i}
                          className={cn(
                            'rounded border px-2 py-1',
                            issue.severity === 'blocked' && 'border-danger/40 bg-danger/10 text-danger',
                            issue.severity === 'warning' && 'border-warning/30 text-warning',
                            issue.severity === 'info' && 'border-border text-muted'
                          )}
                        >
                          <span className="font-semibold">{issue.severity}</span> â€” {issue.message}
                        </li>
                      ))
                    )}
                  </ul>
                  {scan?.safety?.hasBlocked ? (
                    <p className="mt-2 text-[11px] text-warning">
                      Blocked issues stop export/build unless you enable the dev-only unsafe override in Settings.
                    </p>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={working}
                    onClick={() => void refreshScan()}
                  >
                    Refresh scan
                  </Button>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
