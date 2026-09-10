import { useState, useRef } from 'react'
import { FileText, Plus, Trash2, Eye, Upload, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { DOCUMENT_TYPE_LABELS } from '@/constants'
import { useMeridianStore } from '@/lib/store'
import { formatDisplayDate } from '@/lib/utils'
import type { DocumentRecord, DocumentType } from '@/types'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageType(mime: string): boolean {
  return mime.startsWith('image/')
}

function isPdfType(mime: string): boolean {
  return mime === 'application/pdf'
}

function isTextType(mime: string): boolean {
  return mime.startsWith('text/') || mime === 'application/json'
}

export function DocumentsPage() {
  const documents = useMeridianStore((s) => s.documents)
  const applications = useMeridianStore((s) => s.applications)
  const upsertDocument = useMeridianStore((s) => s.upsertDocument)
  const deleteDocument = useMeridianStore((s) => s.deleteDocument)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<DocumentType>('cv')
  const [version, setVersion] = useState('1.0')
  const [applicationId, setApplicationId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileData, setFileData] = useState<string>('')
  const [fileType, setFileType] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [viewingDoc, setViewingDoc] = useState<DocumentRecord | null>(null)

  const sorted = [...documents].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))

  const reset = () => {
    setName('')
    setType('cv')
    setVersion('1.0')
    setApplicationId('')
    setFile(null)
    setFileData('')
    setFileType('')
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    setUploading(true)
    setFile(selected)
    setFileType(selected.type)
    if (!name.trim()) {
      setName(selected.name.replace(/\.[^.]+$/, ''))
    }
    const reader = new FileReader()
    reader.onload = () => {
      setFileData(reader.result as string)
      setUploading(false)
    }
    reader.onerror = () => setUploading(false)
    reader.readAsDataURL(selected)
  }

  function handleSave() {
    const docData: any = {
      name: name.trim(),
      type,
      version: version.trim() || '1.0',
      applicationId: applicationId || undefined,
    }
    if (fileData) {
      docData.fileData = fileData
      docData.fileType = fileType
      docData.fileName = file?.name || name.trim()
    }
    void upsertDocument(docData)
    setOpen(false)
    reset()
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            CV versions, cover letters, and transcripts.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          Add document
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-10" />}
          title="No documents yet."
          description="Track CV and cover letter versions here."
          actionLabel="Add document"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/60 text-[11px] uppercase tracking-wider text-[var(--color-faint)]">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Version</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">File</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Updated</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((doc) => (
                <tr key={doc.id} className="border-b border-[var(--color-border)]/70">
                  <td className="px-4 py-3 font-medium">{doc.name}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {DOCUMENT_TYPE_LABELS[doc.type]}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{doc.version}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)] hidden sm:table-cell">
                    {doc.fileData ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <FileText className="size-3" />
                        {doc.fileName || 'Attached'}
                      </span>
                    ) : doc.fileUrl ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline text-xs">
                        Link
                      </a>
                    ) : (
                      <span className="text-[var(--color-faint)] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)] hidden sm:table-cell">
                    {formatDisplayDate(doc.lastUpdated)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {doc.fileData && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="View document"
                          onClick={() => setViewingDoc(doc)}
                        >
                          <Eye className="size-3.5 text-[var(--color-accent)]" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete document"
                        onClick={() => void deleteDocument(doc.id)}
                      >
                        <Trash2 className="size-3.5 text-[var(--color-danger)]" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Document Modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); reset() }}
        title="Add document"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setOpen(false); reset() }}>Cancel</Button>
            <Button variant="primary" disabled={!name.trim() || uploading} onClick={handleSave}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Select
            label="Type"
            value={type}
            options={(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((k) => ({
              value: k,
              label: DOCUMENT_TYPE_LABELS[k],
            }))}
            onChange={(e) => setType(e.target.value as DocumentType)}
          />
          <Input label="Version" value={version} onChange={(e) => setVersion(e.target.value)} />
          <Select
            label="Linked application"
            value={applicationId}
            placeholder="None"
            options={applications
              .filter((a) => !a.archived)
              .map((a) => ({
                value: a.id,
                label: `${a.companyName} — ${a.jobTitle}`,
              }))}
            onChange={(e) => setApplicationId(e.target.value)}
          />

          <div>
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">File</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.csv,.xlsx,.xls"
              onChange={handleFileSelect}
            />
            {file ? (
              <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
                <FileText className="size-4 text-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text)] flex-1 truncate">{file.name}</span>
                <span className="text-xs text-[var(--color-faint)]">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => { setFile(null); setFileData(''); setFileType('') }}
                  className="text-[var(--color-faint)] hover:text-[var(--color-danger)]"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-6 text-sm text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
              >
                <Upload className="size-4" />
                Click to upload a file
              </button>
            )}
            <p className="text-[10px] text-[var(--color-faint)] mt-1">
              PDF, Word, text, images, or spreadsheets. Stored locally in your browser.
            </p>
          </div>
        </div>
      </Modal>

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <DocumentViewer
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  )
}

function DocumentViewer({ doc, onClose }: { doc: DocumentRecord; onClose: () => void }) {
  const isImg = doc.fileType ? isImageType(doc.fileType) : false
  const isPdf = doc.fileType ? isPdfType(doc.fileType) : false
  const isTxt = doc.fileType ? isTextType(doc.fileType) : false

  function handleDownload() {
    if (!doc.fileData) return
    const a = document.createElement('a')
    a.href = doc.fileData
    a.download = doc.fileName || doc.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={doc.name}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="secondary" onClick={handleDownload}>
            <Download className="size-3.5" />
            Download
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <span>Type: {DOCUMENT_TYPE_LABELS[doc.type]}</span>
          <span>Version: {doc.version}</span>
          {doc.fileName && <span>File: {doc.fileName}</span>}
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden min-h-[400px]">
          {isImg ? (
            <img
              src={doc.fileData}
              alt={doc.name}
              className="max-w-full h-auto mx-auto"
              style={{ maxHeight: '60vh' }}
            />
          ) : isPdf ? (
            <iframe
              src={doc.fileData}
              title={doc.name}
              className="w-full border-0"
              style={{ minHeight: '60vh' }}
            />
          ) : isTxt ? (
            <div className="p-4 font-mono text-xs text-[var(--color-text)] whitespace-pre-wrap overflow-auto" style={{ maxHeight: '60vh' }}>
              {doc.fileData && doc.fileData.includes(',') ? (
                <img src={doc.fileData} alt={doc.name} className="max-w-full" />
              ) : (
                <pre className="whitespace-pre-wrap">{doc.fileData}</pre>
              )}
            </div>
          ) : doc.fileData ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-muted)]">
              <FileText className="size-12 mb-3 text-[var(--color-faint)]" />
              <p className="text-sm">Preview not available for this file type</p>
              <p className="text-xs text-[var(--color-faint)] mt-1">{doc.fileType || 'Unknown type'}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-muted)]">
              <FileText className="size-12 mb-3 text-[var(--color-faint)]" />
              <p className="text-sm">No file data attached</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
