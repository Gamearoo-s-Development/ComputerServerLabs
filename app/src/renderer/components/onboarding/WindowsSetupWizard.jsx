/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { cn } from '../../utils/cn.js'

/** @typedef {'ready' | 'needs_setup' | 'missing' | 'broken' | 'skipped'} StepStatus */

/**
 * @param {StepStatus} status
 */
function stepBadge(status) {
  switch (status) {
    case 'ready':
      return { icon: '✅', label: 'Ready', className: 'text-success border-success/30 bg-success/10' }
    case 'needs_setup':
      return { icon: '⚠', label: 'Needs setup', className: 'text-warning border-warning/30 bg-warning/10' }
    case 'skipped':
      return { icon: '—', label: 'Not required', className: 'text-muted border-border bg-background-elevated/60' }
    default:
      return { icon: '❌', label: status === 'missing' ? 'Missing' : 'Broken', className: 'text-danger border-danger/30 bg-danger/10' }
  }
}

/**
 * @param {{ onComplete: () => void, onSkip?: () => void }} props
 */
export default function WindowsSetupWizard({ onComplete, onSkip }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [runningHello, setRunningHello] = useState(false)
  const [copied, setCopied] = useState(null)

  const runChecks = useCallback(async (runHelloWorld = false) => {
    const api = getApi()
    if (runHelloWorld) setRunningHello(true)
    else setLoading(true)
    try {
      const res = await api?.setup?.runWindowsChecks?.({ runHelloWorld })
      if (res?.ok) setReport(res.data)
    } finally {
      setLoading(false)
      setRunningHello(false)
    }
  }, [])

  useEffect(() => {
    void runChecks(false)
  }, [runChecks])

  const copyCommand = useCallback(async (command, key) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // ignore
    }
  }, [])

  const openUrl = useCallback(async (url) => {
    const api = getApi()
    if (api?.app?.openExternal) await api.app.openExternal(url)
  }, [])

  const finish = useCallback(async () => {
    const api = getApi()
    await api?.setup?.markWindowsComplete?.({ complete: true })
    await onComplete()
  }, [onComplete])

  const steps = report?.steps?.filter((s) => s.id !== 'complete') ?? []
  const completeStep = report?.steps?.find((s) => s.id === 'complete')
  const allReady = report?.allReady === true

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-background/95 p-4 backdrop-blur-md">
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col animate-fade-in border-accent/25 shadow-glow">
        <div className="border-b border-border px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Windows setup</p>
          <h1 className="text-lg font-semibold text-white">Prepare WSL 2 & Docker Desktop</h1>
          <p className="mt-1 text-sm text-muted">
            Container labs need WSL 2 and a running Docker engine. These checks are read-only except the optional
            hello-world test.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {loading && !report ? <p className="text-sm text-muted">Running checks…</p> : null}

          {steps.map((step) => {
            const badge = stepBadge(step.status)
            return (
              <section
                key={step.id}
                className="rounded-xl border border-border/80 bg-background-elevated/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-medium text-white">{step.title}</h2>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                      badge.className
                    )}
                  >
                    <span aria-hidden>{badge.icon}</span>
                    {badge.label}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{step.summary}</p>

                {step.details?.length ? (
                  <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-border/60 bg-background/80 p-2.5 font-mono text-[11px] text-muted-dim whitespace-pre-wrap">
                    {step.details.join('\n')}
                  </pre>
                ) : null}

                {step.instructions?.length && step.status !== 'ready' ? (
                  <div className="mt-3 space-y-2">
                    {step.instructions.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-xs"
                      >
                        <p className="font-medium text-warning">{item.title}</p>
                        <p className="mt-1 text-muted">{item.body}</p>
                        {item.command ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <code className="rounded bg-background px-2 py-1 font-mono text-[11px] text-gray-200">
                              {item.command}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void copyCommand(item.command, item.command)}
                            >
                              {copied === item.command ? 'Copied' : 'Copy'}
                            </Button>
                          </div>
                        ) : null}
                        {item.url ? (
                          <Button className="mt-2" variant="ghost" size="sm" onClick={() => void openUrl(item.url)}>
                            Open guide
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}

          {completeStep ? (
            <section
              className={cn(
                'rounded-xl border p-4',
                allReady ? 'border-success/30 bg-success/5' : 'border-border/80 bg-background-elevated/40'
              )}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden>{allReady ? '✅' : '⚠'}</span>
                <h2 className="font-medium text-white">{completeStep.title}</h2>
              </div>
              <p className="mt-2 text-sm text-muted">{completeStep.summary}</p>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={loading || runningHello} onClick={() => void runChecks(false)}>
              {loading ? 'Checking…' : 'Recheck all'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={loading || runningHello}
              onClick={() => void runChecks(true)}
            >
              {runningHello ? 'Running test…' : 'Run hello-world test'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {onSkip ? (
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Skip for now
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={() => void finish()}>
              {allReady ? 'Continue' : 'Mark complete & continue'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
