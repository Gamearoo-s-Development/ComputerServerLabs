/*

 * This Source Code Form is subject to the terms of the Mozilla Public

 * License, v. 2.0. If a copy of the MPL was not distributed with this

 * file, You can obtain one at https://mozilla.org/MPL/2.0/.

 */



import React from 'react'

import { cn } from '../../utils/cn.js'



/**

 * @param {{

 *   environment: object | null

 *   className?: string

 * }} props

 */

export default function WorkstationDockerStatusPanel({ environment, className }) {

  if (!environment) return null



  const windowsCompat = environment.windowsWorkstation

  const compatLabel = windowsCompat?.available

    ? 'Windows workstation available'

    : windowsCompat?.summary ?? 'Windows workstation unavailable'

  const kvm = environment.dockerKvm

  const kvmLabel = kvm?.available

    ? kvm.desktopRuntimeLabel ?? 'KVM available for desktop VMs'

    : kvm?.desktopRuntimeLabel ?? 'Desktop VMs need KVM (unavailable)'



  return (

    <div

      className={cn(

        'grid gap-2 rounded-lg border border-border bg-background-elevated/40 p-3 text-xs sm:grid-cols-2 lg:grid-cols-5',

        className

      )}

    >

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Docker mode</p>

        <p className="mt-0.5 font-medium text-gray-200">

          {environment.dockerReady ? environment.dockerModeLabel : 'Docker not running'}

        </p>

      </div>

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Host OS</p>

        <p className="mt-0.5 font-medium text-gray-200">{environment.hostOsLabel ?? 'Unknown'}</p>

      </div>

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Compatibility</p>

        <p

          className={cn(

            'mt-0.5 font-medium',

            windowsCompat?.available ? 'text-success' : 'text-warning'

          )}

        >

          {compatLabel}

        </p>

      </div>

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Desktop VM (KVM)</p>

        <p className={cn('mt-0.5 font-medium', kvm?.available ? 'text-success' : 'text-warning')}>{kvmLabel}</p>

      </div>

      <div>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-dim">Desktop runtime</p>

        <p className={cn('mt-0.5 font-medium', kvm?.available ? 'text-success' : 'text-warning')}>

          {kvm?.desktopRuntimeLabel ?? (kvm?.available ? 'Available' : 'Unavailable')}

        </p>

      </div>

      {!kvm?.available && environment.desktopKvmHelpText ? (

        <p className="col-span-full text-[11px] leading-relaxed text-muted-dim">{environment.desktopKvmHelpText}</p>

      ) : null}

      {kvm?.runtime === 'docker-wsl-kvm' && kvm?.available ? (

        <p className="col-span-full text-[11px] leading-relaxed text-muted-dim">

          Windows desktop VMs run through WSL-backed Docker so <code className="text-gray-300">/dev/kvm</code> is

          available. The web viewer uses <code className="text-gray-300">127.0.0.1</code> on your PC.

        </p>

      ) : null}

    </div>

  )

}

