import { useRef, useState } from 'react'
import { Download, Upload, Database, Trash2, FileJson, Tag, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { APP_NAME } from '@/constants'
import { useMeridianStore } from '@/lib/store'
import { exportApplicationsCsv, exportJsonBackup, parseApplicationsCsv } from '@/lib/csv'

export function SettingsPage() {
  const applications = useMeridianStore((s) => s.applications)
  const companies = useMeridianStore((s) => s.companies)
  const requirements = useMeridianStore((s) => s.requirements)
  const documents = useMeridianStore((s) => s.documents)
  const contacts = useMeridianStore((s) => s.contacts)
  const tasks = useMeridianStore((s) => s.tasks)
  const tags = useMeridianStore((s) => s.tags)
  const savedViews = useMeridianStore((s) => s.savedViews)
  const loadDemoData = useMeridianStore((s) => s.loadDemoData)
  const clearAllData = useMeridianStore((s) => s.clearAllData)
  const importApplications = useMeridianStore((s) => s.importApplications)
  const ensureTag = useMeridianStore((s) => s.ensureTag)
  const deleteTag = useMeridianStore((s) => s.deleteTag)
  const pushToast = useMeridianStore((s) => s.pushToast)
  const fileRef = useRef<HTMLInputElement>(null)

  const [newTagName, setNewTagName] = useState('')

  const downloadText = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const onExportCsv = () => {
    downloadText(
      `meridian-applications-${new Date().toISOString().slice(0, 10)}.csv`,
      exportApplicationsCsv(applications),
      'text/csv;charset=utf-8',
    )
    pushToast('success', 'CSV exported')
  }

  const onExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: APP_NAME,
      applications,
      companies,
      requirements,
      documents,
      contacts,
      tasks,
      tags,
      savedViews,
    }
    downloadText(
      `meridian-backup-${new Date().toISOString().slice(0, 10)}.json`,
      exportJsonBackup(payload),
      'application/json',
    )
    pushToast('success', 'JSON backup exported')
  }

  const onImportCsv = async (file: File) => {
    const text = await file.text()
    const { apps, errors } = parseApplicationsCsv(text)
    if (apps.length) await importApplications(apps)
    if (errors.length) pushToast('info', `${errors.length} row(s) had issues`)
  }

  const handleAddTag = async () => {
    if (!newTagName.trim()) return
    await ensureTag(newTagName.trim())
    setNewTagName('')
  }

  const stats = [
    { label: 'Applications', value: applications.filter((a) => !a.archived).length },
    { label: 'Companies', value: companies.length },
    { label: 'Documents', value: documents.length },
    { label: 'Contacts', value: contacts.length },
    { label: 'Tasks', value: tasks.length },
    { label: 'Tags', value: tags.length },
    { label: 'Saved Views', value: savedViews.length },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Data, tags, backups, and sample content.
        </p>
      </div>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h2 className="font-display font-semibold">Data summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-md bg-[var(--color-surface-2)] px-3 py-2 text-center"
            >
              <p className="font-display text-xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-[var(--color-muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <Tag className="size-4 text-[var(--color-accent)]" />
          Tags
        </h2>
        <p className="text-sm text-[var(--color-muted)]">
          Create and manage tags to categorise applications (e.g. Priority, Dream Company, IB, London).
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void handleAddTag()
          }}
        >
          <Input
            placeholder="New tag name…"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="primary" size="sm" disabled={!newTagName.trim()}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </form>
        {tags.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs"
              >
                <span className="text-[var(--color-text)]">{t.name}</span>
                <button
                  type="button"
                  className="text-[var(--color-faint)] hover:text-[var(--color-danger)] cursor-pointer ml-0.5"
                  onClick={() => void deleteTag(t.id)}
                  aria-label={`Delete tag ${t.name}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h2 className="font-display font-semibold">Import / export</h2>
        <p className="text-sm text-[var(--color-muted)]">
          CSV works with common recruiting trackers. JSON is a full local backup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onExportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={onExportJson}>
            <FileJson className="size-4" />
            Export JSON backup
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Import CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportCsv(f)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <h2 className="font-display font-semibold">Sample data</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Load a demo Spring Week / Summer Internship pipeline (clearly marked).
        </p>
        <Button
          variant="primary"
          onClick={() => {
            void loadDemoData()
          }}
        >
          <Database className="size-4" />
          Load demo data
        </Button>
      </section>

      <section className="rounded-lg border border-[rgba(232,93,93,0.35)] bg-[rgba(232,93,93,0.06)] p-5 space-y-4">
        <h2 className="font-display font-semibold text-[var(--color-danger)]">Danger zone</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Clears applications, companies, tasks, documents, and contacts. Tags are kept.
        </p>
        <Button
          variant="danger"
          onClick={() => {
            if (
              window.confirm(
                'Clear all applications and related data? This cannot be undone.',
              )
            ) {
              void clearAllData()
            }
          }}
        >
          <Trash2 className="size-4" />
          Clear all data
        </Button>
      </section>

      <p className="text-xs text-[var(--color-faint)]">
        {APP_NAME} stores data locally in your browser (IndexedDB). Nothing is uploaded.
      </p>
    </div>
  )
}
