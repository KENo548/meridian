import { useEffect, useId, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onCancel])

  if (!open) return null

  const colors = {
    danger: {
      bg: 'bg-red-500/10 border-red-500/30',
      text: 'text-red-400',
      btn: 'bg-red-500 hover:bg-red-600 text-white',
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-400',
      btn: 'bg-amber-500 hover:bg-amber-600 text-white',
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/30',
      text: 'text-blue-400',
      btn: 'bg-blue-500 hover:bg-blue-600 text-white',
    },
  }

  const c = colors[variant]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative ${c.bg} border rounded-xl p-6 max-w-sm w-full shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className={`text-lg font-semibold ${c.text} mb-2`}>{title}</h3>
        <p className="text-sm text-slate-300 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${c.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
