/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useState } from 'react'
import { Button } from '../ui/index.js'
import { getApi } from '../../hooks/useApi.js'
import { cn } from '../../utils/cn.js'

/**
 * @param {{ className?: string }} props
 */
export default function WindowsContainerTestPanel({ className }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  async function runTest() {
    const api = getApi()
    setLoading(true)
    setResult(null)
    try {
      const res = await api?.workstation?.testWindowsContainers?.()
      if (res?.ok) {
        setResult(res.data)
      } else {
        setResult({
          success: false,
          message: res?.error?.message ?? 'Test failed.',
          steps: []
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('rounded-lg border border-border bg-background-elevated/30 p-3', className)}>
      <p className="text-xs font-medium text-gray-200">Test Windows container support</p>
      <p className="mt-1 text-[11px] text-muted">
        Runs <code className="text-accent">docker info</code> and pulls a small Microsoft Nano Server image. This can
        take a few minutes the first time.
      </p>
      <Button variant="secondary" size="sm" className="mt-3" disabled={loading} onClick={() => void runTest()}>
        {loading ? 'Testing…' : 'Test Windows container support'}
      </Button>
      {result ? (
        <div
          className={cn(
            'mt-3 rounded border p-2 text-[11px]',
            result.success ? 'border-success/40 bg-success/5 text-success' : 'border-warning/40 bg-warning/5 text-warning'
          )}
        >
          <p className="font-medium">{result.success ? 'Success' : 'Not ready'}</p>
          <p className="mt-1 text-muted">{result.message}</p>
          {result.steps?.length ? (
            <ul className="mt-2 space-y-1 font-mono text-[10px] text-muted-dim">
              {result.steps.map((step) => (
                <li key={step.step}>
                  {step.success ? '✓' : '✗'} {step.step}: {step.detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
