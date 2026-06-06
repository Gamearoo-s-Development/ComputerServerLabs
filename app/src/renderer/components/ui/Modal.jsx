/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../utils/cn.js'

const MODAL_ROOT_ID = 'modal-root'

function getModalRoot() {
  if (typeof document === 'undefined') return null
  return document.getElementById(MODAL_ROOT_ID) ?? document.body
}

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   title?: string
 *   titleId?: string
 *   children: React.ReactNode
 *   className?: string
 *   panelClassName?: string
 *   size?: 'sm' | 'md' | 'lg'
 * }} props
 */
export default function Modal({
  open,
  onClose,
  title,
  titleId = 'modal-title',
  children,
  className,
  panelClassName,
  size = 'md'
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl'
  }[size]

  const portalTarget = getModalRoot()
  if (!portalTarget) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6',
        'overflow-y-auto overscroll-contain',
        className
      )}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'relative z-10 mx-auto flex w-full flex-col outline-none isolate',
          'max-w-[min(100%,calc(100vw-2rem))]',
          'max-h-[min(92dvh,calc(100dvh-2rem))] animate-fade-in overflow-hidden',
          'rounded-xl border border-border bg-card shadow-glow',
          'focus-visible:ring-2 focus-visible:ring-accent/50',
          sizeClass,
          panelClassName
        )}
      >
        {title ? (
          <div className="shrink-0 border-b border-border px-6 py-4">
            <h2 id={titleId} className="text-lg font-semibold text-white">
              {title}
            </h2>
          </div>
        ) : null}
        {children}
      </div>
    </div>,
    portalTarget
  )
}
