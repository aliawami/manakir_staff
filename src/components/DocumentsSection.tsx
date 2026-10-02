import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { fetchDocument } from '../api/merchantApplications'
import type { ApplicationDocument } from '../api/merchantApplications'
import { describeError } from '../api/errors'
import { inlineKind, normalizeType } from '../lib/fileKind'
import type { InlineKind } from '../lib/fileKind'
import { formatBytes, formatDate } from '../lib/format'

const KIND_LABELS: Record<ApplicationDocument['kind'], string> = {
  CERTIFICATE: 'Certificate',
  NATIONAL_ID: 'National ID',
}

type Shown = {
  document: ApplicationDocument
  url: string
  kind: InlineKind | null
}

/**
 * The applicant's files, and a viewer.
 *
 * Opening a file is an ACTION, not a read: the server writes an audit entry
 * every time. That is why it is a mutation started by a click (a query could
 * be repeated by a retry or a window refocus, and each repeat would be
 * recorded as another viewing), and why buttons are disabled while one is loading.
 */
export function DocumentsSection({
  applicationId,
  documents,
  canView,
}: {
  applicationId: number
  documents: ApplicationDocument[]
  canView: boolean
}) {
  const [shown, setShown] = useState<Shown | null>(null)

  // Give the memory back (and drop the sensitive file) when it is closed or replaced.
  useEffect(() => {
    return () => {
      if (shown) URL.revokeObjectURL(shown.url)
    }
  }, [shown])

  const open = useMutation({
    mutationFn: (document: ApplicationDocument) => fetchDocument(applicationId, document.id),
    onSuccess: (blob, document) => {
      const kind = inlineKind(blob.type)
      // Rebuild the Blob with the checked type, so the browser can only treat it as that.
      const checked = new Blob([blob], {
        type: kind ? normalizeType(blob.type) : 'application/octet-stream',
      })
      setShown({ document, url: URL.createObjectURL(checked), kind })
    },
  })

  return (
    <section>
      <h2>Documents</h2>

      {!canView && (
        <p className="muted">Your role cannot open documents. Their details are listed below.</p>
      )}

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>File</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className={document.is_current ? undefined : 'replaced'}>
              <td>{KIND_LABELS[document.kind]}</td>
              <td>
                <span dir="auto">{document.original_name}</span>
                {!document.is_current && document.superseded_at && (
                  <div className="muted">Replaced on {formatDate(document.superseded_at)}</div>
                )}
              </td>
              <td>{formatBytes(document.size)}</td>
              <td>{formatDate(document.uploaded_at)}</td>
              <td>
                {canView && (
                  <button
                    className="secondary"
                    disabled={open.isPending}
                    onClick={() => open.mutate(document)}
                  >
                    {open.isPending && open.variables?.id === document.id ? 'Opening…' : 'Open'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {documents.length === 0 && <p className="empty">No documents.</p>}

      {open.isError && (
        <p role="alert" className="error">
          Could not open {open.variables?.original_name ?? 'the document'}: {describeError(open.error)}
        </p>
      )}

      {shown && (
        <div className="viewer">
          <div className="viewer-bar">
            <strong dir="auto">
              {KIND_LABELS[shown.document.kind]}: {shown.document.original_name}
            </strong>
            <span className="spacer" />
            <a href={shown.url} download={shown.document.original_name}>
              Download
            </a>
            <button className="secondary" onClick={() => setShown(null)}>
              Close
            </button>
          </div>
          <p className="muted">Opening a document is recorded in the audit log.</p>

          {shown.kind === 'image' && (
            <img src={shown.url} alt={`${KIND_LABELS[shown.document.kind]} uploaded by the applicant`} />
          )}
          {shown.kind === 'pdf' && (
            <iframe src={shown.url} title={`${KIND_LABELS[shown.document.kind]} (PDF)`} />
          )}
          {shown.kind === null && (
            <p>This type of file cannot be shown here. Use Download to open it on your computer.</p>
          )}
        </div>
      )}
    </section>
  )
}
