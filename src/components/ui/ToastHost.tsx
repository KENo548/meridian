import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useMeridianStore } from '@/lib/store'
import { clsx } from '@/lib/utils'
import type { Toast } from '@/types'

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const toneClass: Record<Toast['type'], string> = {
  success: 'border-[rgba(76,175,122,0.4)] text-[var(--color-success)]',
  error: 'border-[rgba(232,93,93,0.4)] text-[var(--color-danger)]',
  info: 'border-[rgba(91,141,239,0.4)] text-[var(--color-info)]',
}

export function ToastHost() {
  const toasts = useMeridianStore((s) => s.toasts)
  const dismissToast = useMeridianStore((s) => s.dismissToast)

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      {toasts.map((t) => {
        const Icon = icons[t.type]
        return (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 rounded-md border bg-[var(--color-surface-2)] px-3 py-2.5 shadow-lg animate-fade-in',
              toneClass[t.type],
            )}
          >
            <Icon className="size-4 shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-[var(--color-text)]">{t.message}</p>
            <button
              type="button"
              className="text-[var(--color-faint)] hover:text-[var(--color-text)] cursor-pointer"
              onClick={() => dismissToast(t.id)}
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
