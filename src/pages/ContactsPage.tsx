import { useState } from 'react'
import { Users, Plus, Trash2, ExternalLink as ExtLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useMeridianStore } from '@/lib/store'
import { formatDisplayDate, isValidUrl } from '@/lib/utils'

export function ContactsPage() {
  const contacts = useMeridianStore((s) => s.contacts)
  const applications = useMeridianStore((s) => s.applications)
  const upsertContact = useMeridianStore((s) => s.upsertContact)
  const deleteContact = useMeridianStore((s) => s.deleteContact)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [relationship, setRelationship] = useState('')
  const [notes, setNotes] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [lastContact, setLastContact] = useState('')
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null)

  const sorted = [...contacts].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const reset = () => {
    setName('')
    setPosition('')
    setCompany('')
    setEmail('')
    setLinkedinUrl('')
    setRelationship('')
    setNotes('')
    setApplicationId('')
    setLastContact('')
  }

  const linkedApps = applications.filter((a) => !a.archived)

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Recruiters, alumni, and networking contacts.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          Add contact
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Users className="size-10" />}
          title="No contacts yet."
          description="Track recruiters, alumni, and networking contacts here."
          actionLabel="Add contact"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/60 text-[11px] uppercase tracking-wider text-[var(--color-faint)]">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Position</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Company</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Relationship</th>
                <th className="px-4 py-2.5 hidden lg:table-cell">Last Contact</th>
                <th className="px-4 py-2.5 hidden lg:table-cell">Linked Application</th>
                <th className="px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const app = c.applicationId
                  ? applications.find((a) => a.id === c.applicationId)
                  : undefined
                return (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-border)]/70 hover:bg-[var(--color-surface-2)]/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="text-xs text-[var(--color-teal)] hover:text-[var(--color-accent)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.email}
                        </a>
                      ) : null}
                      {c.linkedinUrl && isValidUrl(c.linkedinUrl) ? (
                        <a
                          href={c.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-[var(--color-teal)] hover:text-[var(--color-accent)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          LinkedIn <ExtLink className="size-2.5" />
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] hidden sm:table-cell">
                      {c.position || '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] hidden md:table-cell">
                      {c.company || '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] hidden md:table-cell">
                      {c.relationship || '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)] hidden lg:table-cell">
                      {c.lastContact ? formatDisplayDate(c.lastContact) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {app ? (
                        <button
                          type="button"
                          className="text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
                          onClick={() => setActiveApplicationId(app.id)}
                        >
                          {app.companyName}
                        </button>
                      ) : (
                        <span className="text-[var(--color-faint)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete contact"
                        onClick={() => setDeleteContactId(c.id)}
                      >
                        <Trash2 className="size-3.5 text-[var(--color-danger)]" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          reset()
        }}
        title="Add contact"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={() => {
                void upsertContact({
                  name: name.trim(),
                  position: position.trim() || undefined,
                  company: company.trim() || undefined,
                  email: email.trim() || undefined,
                  linkedinUrl: linkedinUrl.trim() || undefined,
                  relationship: relationship.trim() || undefined,
                  notes: notes.trim() || undefined,
                  applicationId: applicationId || undefined,
                  lastContact: lastContact || undefined,
                })
                setOpen(false)
                reset()
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input
            label="Position"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
          <Input
            label="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="LinkedIn URL"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
          <Input
            label="Relationship"
            placeholder="e.g. Alumni, Recruiter, Referral"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          />
          <Input
            label="Last contacted"
            type="date"
            value={lastContact}
            onChange={(e) => setLastContact(e.target.value)}
          />
          <Select
            label="Linked application"
            value={applicationId}
            placeholder="None"
            options={linkedApps.map((a) => ({
              value: a.id,
              label: `${a.companyName} — ${a.jobTitle}`,
            }))}
            onChange={(e) => setApplicationId(e.target.value)}
          />
          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteContactId}
        title="Delete Contact"
        message="Permanently delete this contact? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteContactId) void deleteContact(deleteContactId); setDeleteContactId(null) }}
        onCancel={() => setDeleteContactId(null)}
      />
    </div>
  )
}
