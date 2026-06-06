/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import { Button, StatusBadge } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { cn } from '../../utils/cn.js'
import WorkstationDockerStatusPanel from '../workstation/WorkstationDockerStatusPanel.jsx'
import WorkstationWhyDisabledModal from '../workstation/WorkstationWhyDisabledModal.jsx'

import {
  safeIsDesktopContainerProvider
} from '@sysadmin-game/shared/workstations/providerUtils.js'

/**
 * @param {string} id
 */
function isDesktopWorkstationOption(id) {
  return safeIsDesktopContainerProvider(id)
}

/**
 * @param {object[]} options
 */
function findFirstDeployableOption(options) {
  const required = options.find((o) => o.required && o.canDeploy !== false && !o.disabled)
  if (required) return required
  const auto = options.find((o) => o.id === 'auto' && o.canDeploy !== false && !o.disabled)
  if (auto) return auto
  const linux = options.find(
    (o) =>
      o.canDeploy !== false &&
      !o.disabled &&
      (o.id === 'ubuntu-terminal' || o.id === 'debian-terminal')
  )
  if (linux) return linux
  return options.find((o) => o.canDeploy !== false && !o.disabled) ?? null
}

/**
 * @param {{
 *   open: boolean
 *   labId: string | null
 *   labTitle?: string
 *   developerMode?: boolean
 *   onClose: () => void
 *   onConfirm: (workstationPreference: string) => void
 * }} props
 */
export default function ChooseLabWorkstationModal({
  open,
  labId,
  labTitle,
  developerMode = false,
  onClose,
  onConfirm
}) {
  const [options, setOptions] = useState([])
  const [environment, setEnvironment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedWorkstationId, setSelectedWorkstationId] = useState('auto')
  const [fallbackNote, setFallbackNote] = useState(null)
  const [error, setError] = useState(null)
  const [localTerminalAck, setLocalTerminalAck] = useState(false)
  const [whyOption, setWhyOption] = useState(null)
  const userPickedRef = useRef(false)

  const pickDefaultSelection = useCallback((list) => {
    const pick = findFirstDeployableOption(list)
    return pick?.id ?? 'auto'
  }, [])

  const loadOptions = useCallback(async () => {
    if (!labId) return
    const api = getApi()
    setLoading(true)
    setError(null)
    try {
      const res = await api?.labs?.workstationOptions?.(labId)
      if (!res?.ok) {
        setError(res?.error?.message ?? 'Could not load workstation options.')
        return
      }
      const payload = res.data ?? {}
      const list = Array.isArray(payload) ? payload : (payload.options ?? [])
      const env = Array.isArray(payload) ? null : (payload.environment ?? null)
      setOptions(list)
      setEnvironment(env)

      const defaultId = pickDefaultSelection(list)
      if (!userPickedRef.current) {
        setSelectedWorkstationId(defaultId)
        const recommended = list.find((o) => o.id === 'auto')
        const hasDesktopKvmFallbackNote = (recommended?.notes ?? []).some((n) =>
          /KVM is not available/i.test(n)
        )
        setFallbackNote(
          hasDesktopKvmFallbackNote
            ? 'Desktop container workstations need KVM. Lab Recommended will use a Linux terminal instead.'
            : null
        )
      }
    } finally {
      setLoading(false)
    }
  }, [labId, pickDefaultSelection])

  useEffect(() => {
    if (!open) {
      userPickedRef.current = false
      setWhyOption(null)
      setFallbackNote(null)
      return
    }
    setLocalTerminalAck(false)
    if (!labId) return
    void loadOptions()
  }, [open, labId, loadOptions])

  const selectedOption = useMemo(
    () => options.find((o) => o.id === selectedWorkstationId),
    [options, selectedWorkstationId]
  )

  const deployableOptions = useMemo(
    () => options.filter((o) => o.canDeploy !== false && o.disabled !== true),
    [options]
  )

  const needsLocalTerminalAck = selectedWorkstationId === 'local-terminal'
  const needsWslTerminalAck = selectedWorkstationId === 'wsl-local-terminal'

  const startDisabledReason = useMemo(() => {
    if (loading) return 'Loading workstation options…'
    if (error) return error
    if (!options.length) return 'No workstation options returned for this lab.'
    if (!deployableOptions.length) {
      return 'No compatible workstation is available. Check Docker Desktop is running.'
    }
    if (!selectedOption) return 'Select a workstation to continue.'
    if (selectedOption.canDeploy === false || selectedOption.disabled) {
      return (
        selectedOption.unavailableMessage ??
        'This workstation cannot be deployed on your system right now.'
      )
    }
    if (!selectedOption.meetsLabRequirements) {
      return selectedOption.compatibilityMessage ?? 'This workstation does not meet lab requirements.'
    }
    if (needsLocalTerminalAck && !localTerminalAck) {
      return 'Confirm that you understand the local terminal risks.'
    }
    if (needsWslTerminalAck && !localTerminalAck) {
      return 'Confirm that you understand the WSL local terminal risks.'
    }
    return null
  }, [
    loading,
    error,
    options.length,
    deployableOptions.length,
    selectedOption,
    needsLocalTerminalAck,
    needsWslTerminalAck,
    localTerminalAck
  ])

  const canStartLab = startDisabledReason == null

  const handleSelect = (option) => {
    if (option.disabled || option.canDeploy === false) return
    userPickedRef.current = true
    setSelectedWorkstationId(option.id)
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[workstation] selected', option.id)
    }
  }

  const handleStartLab = () => {
    let choiceId = selectedWorkstationId
    let choiceOption = options.find((o) => o.id === choiceId)

    if (!choiceOption || choiceOption.canDeploy === false || choiceOption.disabled) {
      const fallback = findFirstDeployableOption(options)
      if (fallback) {
        choiceId = fallback.id
        choiceOption = fallback
        setSelectedWorkstationId(choiceId)
      }
    }

    if (!choiceOption || choiceOption.canDeploy === false || choiceOption.disabled) {
      return
    }
    if ((choiceId === 'local-terminal' || choiceId === 'wsl-local-terminal') && !localTerminalAck) return

    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[workstation] selected', choiceId)
      console.debug('[deployment] starting', choiceId)
    }

    onConfirm(choiceId)
  }

  function renderBadge(option) {
    if (option.badge === 'recommended') {
      return <StatusBadge label="Workstation" value="Recommended" variant="success" />
    }
    if (option.badge === 'advanced') {
      return <StatusBadge label="Workstation" value="Advanced" variant="neutral" />
    }
    return null
  }

  const recommendedOptions = useMemo(
    () =>
      options.filter(
        (o) =>
          o.section === 'recommended' ||
          o.id === 'auto' ||
          o.id === 'ubuntu-terminal' ||
          o.id === 'debian-terminal' ||
          o.id === 'custom'
      ),
    [options]
  )
  const advancedDesktopOptions = useMemo(
    () =>
      options.filter(
        (o) => o.section === 'advanced-desktop' || (o.kind === 'docker-desktop' && isDesktopWorkstationOption(o.id))
      ),
    [options]
  )
  const advancedLocalOptions = useMemo(
    () => options.filter((o) => ['wsl-local-terminal', 'local-terminal'].includes(o.id)),
    [options]
  )

  function renderOption(option) {
    const isSelected = selectedWorkstationId === option.id
    const isDisabled = option.disabled === true || option.canDeploy === false

    return (
      <li
        key={option.id}
        className={cn(
          'rounded-lg border transition-colors',
          isSelected
            ? 'border-accent ring-1 ring-accent/40 bg-accent/5'
            : 'border-border bg-background-elevated/40',
          isDisabled && 'opacity-80'
        )}
      >
        <button
          type="button"
          disabled={isDisabled}
          aria-pressed={isSelected}
          onClick={() => handleSelect(option)}
          className={cn(
            'w-full px-3 py-3 text-left',
            isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent/5'
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                isSelected ? 'border-accent bg-accent' : 'border-border-muted'
              )}
              aria-hidden
            >
              {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            </span>
            <span className="text-sm font-medium text-gray-200">{option.name}</span>
            {renderBadge(option)}
            {option.badgeHint && !isDisabled ? (
              <span className="text-[10px] text-muted-dim">{option.badgeHint}</span>
            ) : null}
            {isDesktopWorkstationOption(option.id) ? (
              <>
                <StatusBadge label="Runtime" value="Docker/QEMU" variant="neutral" />
                <StatusBadge
                  label="Access"
                  value={option.id === 'desktop-container-windows' ? 'Browser / VNC / RDP' : 'Browser / VNC'}
                  variant="neutral"
                />
                <StatusBadge label="Level" value="Advanced" variant="neutral" />
                {option.desktopStatusLabel ? (
                  <StatusBadge
                    label="Desktop"
                    value={option.desktopStatusLabel}
                    variant={
                      option.desktopRuntimeStatus === 'available'
                        ? 'success'
                        : option.desktopRuntimeStatus === 'unavailable'
                          ? 'danger'
                          : 'warning'
                    }
                  />
                ) : null}
              </>
            ) : null}
            {option.needsImageConfigured ? (
              <StatusBadge label="Image" value="Not configured" variant="warning" />
            ) : null}
            {option.required ? <StatusBadge label="Lab" value="Required" variant="warning" /> : null}
            {option.notSandboxed ? (
              <StatusBadge label="Safety" value="Not sandboxed" variant="danger" />
            ) : null}
            {isDesktopWorkstationOption(option.id) && !option.hostAvailable ? (
              <StatusBadge label="Status" value="Unavailable" variant="warning" />
            ) : null}
          </div>

          {option.runtimeNote ? (
            <p className="mt-1 pl-6 text-[11px] text-muted-dim">Runtime: {option.runtimeNote}</p>
          ) : null}
          {option.description ? <p className="mt-1 pl-6 text-xs text-muted">{option.description}</p> : null}
          {isDesktopWorkstationOption(option.id) && option.hostAvailable && !option.needsImageConfigured ? (
            <p className="mt-2 pl-6 text-[11px] text-warning">
              {option.id === 'desktop-container-kali'
                ? 'Kali images are larger and intended for advanced labs. Desktop workstations need several GB of RAM/disk and KVM.'
                : option.id === 'desktop-container-windows'
                  ? 'Windows desktop VMs in Docker/QEMU may need 4GB+ RAM, 20GB+ disk, and hardware virtualization.'
                  : 'Desktop workstations are heavier than terminal containers and may require several GB of RAM/disk and KVM.'}
            </p>
          ) : null}
          {isDesktopWorkstationOption(option.id) && !option.hostAvailable ? (
            <>
              <p className="mt-2 pl-6 text-[11px] font-medium text-warning">
                Reason: {option.hostStatusReason ?? 'KVM/nested virtualization unavailable'}
              </p>
              {environment?.desktopKvmHelpText ? (
                <p className="mt-1 pl-6 text-[11px] text-muted-dim">{environment.desktopKvmHelpText}</p>
              ) : null}
            </>
          ) : null}
          {(option.notes ?? []).map((note) => (
            <p key={note} className="mt-1 pl-6 text-[11px] text-muted-dim">
              {note}
            </p>
          ))}
          {option.compatibilityMessage && !isDisabled ? (
            <p
              className={cn(
                'mt-1 pl-6 text-[11px]',
                /^Works[.!]/.test(option.compatibilityMessage) ? 'text-muted' : 'text-warning'
              )}
            >
              {option.compatibilityMessage}
            </p>
          ) : null}
          {option.unavailableMessage && isDisabled ? (
            <p className="mt-2 pl-6 text-[11px] font-medium text-warning">{option.unavailableMessage}</p>
          ) : null}
        </button>
        {isDisabled && (option.disabledReasons?.length || option.unavailableMessage) ? (
          <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setWhyOption(option)
              }}
            >
              Why?
            </Button>
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Choose Lab Workstation"
        size="lg"
        panelClassName="max-w-2xl"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
            <p className="text-sm text-muted">
              {labTitle ? (
                <>
                  Select how you want to work in <span className="text-gray-200">{labTitle}</span>. Terminal workstations
                  are lightweight jump boxes; desktop options run full OS environments in Docker/QEMU (requires KVM).
                </>
              ) : (
                'Select the workstation environment for this lab session.'
              )}
            </p>

            <WorkstationDockerStatusPanel environment={environment} />

            {fallbackNote ? <p className="text-xs text-warning">{fallbackNote}</p> : null}

            {loading ? <p className="text-xs text-muted">Loading workstation options…</p> : null}
            {error ? <p className="text-xs text-danger">{error}</p> : null}

            {recommendedOptions.length > 0 ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">
                  Recommended terminal workstations
                </p>
                <ul className="space-y-3">{recommendedOptions.map((option) => renderOption(option))}</ul>
              </>
            ) : null}
            {advancedDesktopOptions.length > 0 ? (
              <>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-dim">
                  Advanced desktop workstations
                </p>
                <ul className="space-y-3">{advancedDesktopOptions.map((option) => renderOption(option))}</ul>
              </>
            ) : null}
            {advancedLocalOptions.length > 0 ? (
              <>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Advanced local</p>
                <ul className="space-y-3">{advancedLocalOptions.map((option) => renderOption(option))}</ul>
              </>
            ) : null}

            {options.length > 0 && !deployableOptions.length ? (
              <p className="text-xs text-danger">
                No workstation can be deployed on this system for this lab. Check Docker Desktop is running and
                configure desktop runtimes in Settings if you need a desktop workstation.
              </p>
            ) : null}

          {needsLocalTerminalAck || needsWslTerminalAck ? (
            <div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm font-medium text-danger">
                {needsWslTerminalAck ? 'WSL Local Linux Terminal (advanced)' : 'Local Terminal (advanced)'}
              </p>
              <p className="mt-2 text-xs text-muted">
                {needsWslTerminalAck
                  ? 'This uses your real WSL distribution. Commands may affect files inside your WSL environment. Docker container workstations are safer.'
                  : 'Uses your real system terminal. Commands may affect your computer. Prefer Docker container workstations whenever possible.'}
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs text-gray-200">
                <input
                  type="checkbox"
                  checked={localTerminalAck}
                  onChange={(e) => setLocalTerminalAck(e.target.checked)}
                  className="mt-0.5 rounded border-border"
                />
                I understand — use this host-side terminal for this lab session
              </label>
            </div>
          ) : null}

            {developerMode ? (
              <div className="rounded-lg border border-dashed border-border-muted bg-background/60 p-3 font-mono text-[10px] text-muted-dim">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">Workstation debug</p>
                <p>selectedWorkstationId: {selectedWorkstationId}</p>
                <p>canStartLab: {String(canStartLab)}</p>
                <p>startDisabledReason: {startDisabledReason ?? '(none)'}</p>
                <p>dockerMode: {environment?.dockerModeLabel ?? 'unknown'}</p>
                <p>deployable: {deployableOptions.map((o) => o.id).join(', ') || '(none)'}</p>
                <p>selected.canDeploy: {String(selectedOption?.canDeploy ?? 'n/a')}</p>
                <p>selected.disabled: {String(selectedOption?.disabled ?? 'n/a')}</p>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border bg-card px-6 py-4">
            {startDisabledReason && !loading ? (
              <p className="mb-3 text-xs text-warning">{startDisabledReason}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                disabled={!canStartLab}
                onClick={handleStartLab}
              >
                Start Lab
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <WorkstationWhyDisabledModal
        open={Boolean(whyOption)}
        onClose={() => setWhyOption(null)}
        optionName={whyOption?.name}
        reasons={whyOption?.disabledReasons}
        setupUrl={environment?.windowsContainerSetupUrl}
      />
    </>
  )
}
